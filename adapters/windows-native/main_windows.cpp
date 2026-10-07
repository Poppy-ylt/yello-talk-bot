/**
 * GME Music Bot - Companion service for YelloTalk bot (Windows native version)
 * Joins a Tencent GME voice room and plays music via StartAccompany.
 *
 * Ported from main_linux.cpp. Unlike Linux (which loads Android .so files via
 * dlopen through a bionic-compat shim), the official Windows GME SDK is a
 * real Windows DLL/import-lib, so we link against gmesdk.lib directly.
 *
 * THREADING: GME SDK requires all calls on the main thread.
 * HTTP thread only parses requests and queues commands.
 * Main thread loop processes commands + calls Poll().
 *
 * Controlled via HTTP (default port 9876, override with --port):
 *   POST /join    {"room": "gme_room_id", "user": "numeric_gme_id", "uuid": "real_uuid"}
 *   POST /play    {"file": "path/to/song.mp3", "loop": true}
 *   POST /stop
 *   POST /pause
 *   POST /resume
 *   POST /volume  {"vol": 100}
 *   POST /effect-play {"file": "path/to/speech.wav", "effectId": 9001, "volume": 100, "send": true}
 *   POST /effect-stop {"effectId": 9001}
 *   POST /effect-volume {"effectId": 9001, "volume": 100}
 *   POST /room-quality {"quality": "fluency|standard|highquality"}
 *   POST /leave
 *   GET  /status
 */

#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include "tmg_sdk.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <thread>
#include <mutex>
#include <chrono>
#include <string>
#include <algorithm>
#include "adapter-security.h"

#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "uuid.lib")

static std::string g_gmeAppId;
static std::string g_gmeAppKey;
static int g_gmeAppIdNumber = 0;

static bool loadGmeCredentials() {
    const char* appId = getenv("GME_SDK_APP_ID");
    const char* appKey = getenv("GME_SDK_KEY");
    if (!appId || !*appId || !appKey || strlen(appKey) != 16) return false;
    for (const char* cursor = appId; *cursor; ++cursor) {
        if (*cursor < '0' || *cursor > '9') return false;
    }
    char* end = nullptr;
    const unsigned long value = strtoul(appId, &end, 10);
    if (!end || *end || value == 0 || value > 2147483647UL) return false;
    g_gmeAppId = appId;
    g_gmeAppKey = appKey;
    g_gmeAppIdNumber = static_cast<int>(value);
    return true;
}

// Runtime config (overridable via CLI args)
static int g_httpPort = 9876;
static char g_botId[128] = {0};

static void sleepMs(int ms) { Sleep(ms); }

// ==================== GME CONTEXT ====================
static ITMGContext* GetGMEContext() {
    return ITMGContextGetInstance();
}

// ==================== GLOBAL STATE ====================
static volatile bool g_running = true;
static volatile bool g_initialized = false;
static volatile bool g_inRoom = false;
static volatile bool g_playing = false;
static volatile bool g_songFinished = false;
static void extractStr(const char* body, const char* key, char* out, size_t outLen);
static volatile bool g_userStopped = false;
static volatile bool g_audioEnabled = false;
static volatile bool g_effectPlaying = false;
static volatile int g_effectId = 0;
static char g_currentFile[512] = {0};
static char g_roomId[256] = {0};
static char g_userId[256] = {0};
static char g_lastError[512] = {0};
static volatile int g_lastEventType = -1;
// GME room-wide audio profile: 1=fluency, 2=standard, 3=highquality.
// This is distinct from accompaniment volume, which only affects the bot.
static volatile int g_roomType = 0;
// ChangeRoomType is asynchronous too, so wait for the server acknowledgement
// before reporting a room-quality change to the HTTP caller.
static volatile bool g_roomTypeChangeEventReceived = false;
static volatile int g_roomTypeChangeResult = -1;

static const char* roomTypeName(int roomType) {
    switch (roomType) {
        case ITMG_ROOM_TYPE_FLUENCY: return "fluency";
        case ITMG_ROOM_TYPE_STANDARD: return "standard";
        case ITMG_ROOM_TYPE_HIGHQUALITY: return "highquality";
        default: return "unknown";
    }
}

static int parseRoomType(const char* value) {
    if (!value) return 0;
    if (strcmp(value, "fluency") == 0 || strcmp(value, "1") == 0) return ITMG_ROOM_TYPE_FLUENCY;
    if (strcmp(value, "standard") == 0 || strcmp(value, "2") == 0) return ITMG_ROOM_TYPE_STANDARD;
    if (strcmp(value, "highquality") == 0 || strcmp(value, "high-quality") == 0 || strcmp(value, "3") == 0) return ITMG_ROOM_TYPE_HIGHQUALITY;
    return 0;
}

static int parseEventInt(const char* data, const char* key, int fallback = -1) {
    if (!data || !key) return fallback;
    const char* value = strstr(data, key);
    if (!value) return fallback;
    value = strchr(value, ':');
    return value ? atoi(value + 1) : fallback;
}

// Use the highest-fidelity room profile whenever this client enters a room.
// The profile can still be changed later through POST /room-quality.
static const ITMG_ROOM_TYPE DEFAULT_ROOM_TYPE = ITMG_ROOM_TYPE_HIGHQUALITY;

// Console verbosity: by default only real errors/failures print. GME fires
// event callbacks and frequent HTTP status/volume polls; use --verbose when
// actively debugging so routine traffic does not bury actionable messages.
static bool g_verbose = false;
#define LOGI(...) do { if (g_verbose) { printf(__VA_ARGS__); fflush(stdout); } } while(0)
#define LOGE(...) do { printf(__VA_ARGS__); fflush(stdout); } while(0)

// ==================== COMMAND QUEUE ====================
enum CmdType { CMD_NONE = 0, CMD_JOIN, CMD_LEAVE, CMD_PLAY, CMD_STOP, CMD_PAUSE, CMD_RESUME, CMD_VOLUME, CMD_EFFECT_PLAY, CMD_EFFECT_STOP, CMD_EFFECT_VOLUME, CMD_ROOM_TYPE };

struct Command {
    volatile CmdType type;
    char room[256];
    char user[256];
    char uuid[256];
    char file[512];
    bool loop;
    int volume;
    int effectId;
    bool effectSend;
    int roomType;
    volatile bool pending;
    volatile bool done;
    volatile bool success;
    char resultMsg[16384];
};

static Command g_cmd = {};
static std::mutex g_cmdMutex;
static std::string jsonEscape(const char* value);

// ==================== GME DELEGATE ====================
class GMEDelegate : public ITMGDelegate {
public:
    void OnEvent(ITMG_MAIN_EVENT_TYPE eventType, const char* data) override {
        g_lastEventType = eventType;
        switch (eventType) {
            case ITMG_MAIN_EVENT_TYPE_ENTER_ROOM:
                LOGI("[GME] Entered room! data=%s\n", data ? data : "null");
                g_inRoom = true;
                g_lastError[0] = 0;
                enableAudioInternal();
                {
                    ITMGRoom* room = GetGMEContext()->GetRoom();
                    if (room) g_roomType = room->GetRoomType();
                }
                break;
            case ITMG_MAIN_EVENT_TYPE_EXIT_ROOM:
                LOGI("[GME] Exited room\n");
                g_inRoom = false;
                g_playing = false;
                g_songFinished = false;
                g_roomType = 0;
                g_audioEnabled = false;
                g_effectPlaying = false;
                g_effectId = 0;
                break;
            case ITMG_MAIN_EVENT_TYPE_ROOM_DISCONNECT:
                LOGE("[GME] Room disconnected: %s\n", data ? data : "null");
                g_inRoom = false;
                g_playing = false;
                g_songFinished = false;
                g_roomType = 0;
                g_audioEnabled = false;
                g_effectPlaying = false;
                g_effectId = 0;
                snprintf(g_lastError, sizeof(g_lastError), "Room disconnected: %s", data ? data : "unknown");
                break;
            case ITMG_MAIN_EVENT_TYPE_ACCOMPANY_FINISH:
                LOGI("[GME] Accompaniment finished (userStopped=%d)\n", (int)g_userStopped);
                if (!g_playing) break;
                if (GetGMEContext() && GetGMEContext()->GetAudioEffectCtrl()
                    && !GetGMEContext()->GetAudioEffectCtrl()->IsAccompanyPlayEnd()) break;
                g_playing = false;
                g_songFinished = !g_userStopped;
                g_userStopped = false;
                break;
            case ITMG_MAIN_EVENT_TYPE_CHANGE_ROOM_TYPE: {
                ITMGRoom* room = GetGMEContext() ? GetGMEContext()->GetRoom() : nullptr;
                if (room) g_roomType = room->GetRoomType();
                g_roomTypeChangeResult = parseEventInt(data, "\"result\"", -1);
                g_roomTypeChangeEventReceived = true;
                LOGE("[GME] Room quality change acknowledged: type=%d (%s) data=%s\n",
                    (int)g_roomType, roomTypeName(g_roomType), data ? data : "null");
                break;
            }
            case 1022:
                break;
            default:
                LOGI("[GME] Event %d: %s\n", eventType, data ? data : "null");
                break;
        }
    }

    static void enableAudioInternal() {
        ITMGContext* context = GetGMEContext();
        if (!context) return;
        ITMGAudioCtrl* audioCtrl = context->GetAudioCtrl();
        if (audioCtrl) {
            audioCtrl->EnableAudioCaptureDevice(true);
            audioCtrl->EnableAudioSend(true);
            audioCtrl->SetMicVolume(0);
            audioCtrl->EnableSpeaker(false);

            ITMGAudioEffectCtrl* effectCtrl = context->GetAudioEffectCtrl();
            if (effectCtrl) effectCtrl->SetAccompanyVolume(5);

            g_audioEnabled = true;
            LOGI("[GME] Music uplink enabled with microphone muted\n");
        }
    }
};
static GMEDelegate g_delegate;

// ==================== GME OPERATIONS (MAIN THREAD ONLY) ====================

bool initGME(const char* userId) {
    ITMGContext* context = GetGMEContext();
    if (!context) {
        snprintf(g_lastError, sizeof(g_lastError), "Failed to get GME context");
        return false;
    }

    if (g_initialized && strcmp(g_userId, userId) == 0) {
        LOGI("[GME] Already initialized with this identity, skipping\n");
        return true;
    }

    if (g_initialized || g_lastEventType >= 0) {
        LOGI("[GME] Uninitializing before re-init...\n");
        if (g_inRoom) {
            context->ExitRoom();
            for (int i = 0; i < 10; i++) { context->Poll(); sleepMs(100); }
        }
        context->Uninit();
        g_initialized = false;
        g_inRoom = false;
        g_audioEnabled = false;
        g_effectPlaying = false;
        g_effectId = 0;
        g_songFinished = false;
        g_roomType = 0;
        sleepMs(200);
    }

    context->SetTMGDelegate(&g_delegate);
    context->SetLogLevel(TMG_LOG_LEVEL_INFO, TMG_LOG_LEVEL_INFO);

    LOGI("[GME] Init with configured SDK identity\n");

    int ret = context->Init(g_gmeAppId.c_str(), userId);
    if (ret != 0) {
        LOGE("[GME] Init failed: %d\n", ret);
        snprintf(g_lastError, sizeof(g_lastError), "GME Init failed: %d", ret);
        context->Uninit();
        return false;
    }

    g_initialized = true;
    strncpy(g_userId, userId, sizeof(g_userId) - 1);
    g_lastError[0] = 0;
    LOGI("[GME] Initialized\n");
    return true;
}

bool enterRoom(const char* roomId, const char* authUserId) {
    ITMGContext* context = GetGMEContext();
    if (!context) return false;

    const char* authId = (authUserId && strlen(authUserId) > 0) ? authUserId : g_userId;

    unsigned char authBuffer[512] = {0};
    int authLen = QAVSDK_AuthBuffer_GenAuthBuffer(
        g_gmeAppIdNumber, roomId, authId, g_gmeAppKey.c_str(), authBuffer, sizeof(authBuffer));

    if (authLen <= 0) {
        snprintf(g_lastError, sizeof(g_lastError), "GenAuthBuffer failed (code=%d)", authLen);
        LOGE("[GME] %s\n", g_lastError);
        return false;
    }

    LOGI("[GME] AuthBuffer generated (%d bytes)\n", authLen);
    LOGI("[GME] EnterRoom: room=%s, type=HIGHQUALITY\n", roomId);

    int ret = context->EnterRoom(roomId, DEFAULT_ROOM_TYPE, (const char*)authBuffer, authLen);
    if (ret != 0) {
        snprintf(g_lastError, sizeof(g_lastError), "EnterRoom returned: %d", ret);
        LOGE("[GME] %s\n", g_lastError);
        return false;
    }

    strncpy(g_roomId, roomId, sizeof(g_roomId) - 1);
    g_roomType = DEFAULT_ROOM_TYPE;
    LOGI("[GME] EnterRoom accepted, waiting for callback...\n");
    return true;
}

// ChangeRoomType returns only the local enqueue result. The authoritative
// result arrives through OnEvent, so always poll until the callback (or a
// bounded timeout) before reporting success.
static bool changeRoomTypeAndWait(ITMGContext* context, ITMGRoom* room, int requestedType,
                                  int timeoutMs, int* outCode = nullptr) {
    if (outCode) *outCode = -1;
    if (!context || !room) return false;
    const int current = room->GetRoomType();
    if (current == requestedType) {
        g_roomType = requestedType;
        if (outCode) *outCode = 0;
        return true;
    }

    g_roomTypeChangeEventReceived = false;
    g_roomTypeChangeResult = -1;
    const int ret = room->ChangeRoomType((ITMG_ROOM_TYPE)requestedType);
    if (outCode) *outCode = ret;
    if (ret != 0) return false;

    const int iterations = timeoutMs / 100 > 1 ? timeoutMs / 100 : 1;
    for (int i = 0; i < iterations; i++) {
        context->Poll();
        const int observed = room->GetRoomType();
        if (observed > 0) g_roomType = observed;
        if (g_roomTypeChangeEventReceived) {
            if (g_roomTypeChangeResult != 0) return false;
            if (observed == requestedType || g_roomType == requestedType) return true;
        }
        // Some older SDK builds update GetRoomType before delivering event 21.
        // Accept that state after a short settling period, but never return
        // immediately after the enqueue call.
        if (i >= 2 && (observed == requestedType || g_roomType == requestedType)) return true;
        sleepMs(100);
    }
    const int observed = room->GetRoomType();
    if (observed > 0) g_roomType = observed;
    return observed == requestedType || g_roomType == requestedType;
}

bool playMusic(const char* filePath, bool loop) {
    ITMGContext* context = GetGMEContext();
    if (!context || !g_inRoom) {
        snprintf(g_lastError, sizeof(g_lastError), "Not in room (inRoom=%d, init=%d)", (int)g_inRoom, (int)g_initialized);
        return false;
    }
    DWORD attrs = GetFileAttributesA(filePath);
    if (attrs == INVALID_FILE_ATTRIBUTES) {
        snprintf(g_lastError, sizeof(g_lastError), "File not found: %s", filePath);
        return false;
    }
    ITMGAudioEffectCtrl* effectCtrl = context->GetAudioEffectCtrl();
    if (!effectCtrl) {
        snprintf(g_lastError, sizeof(g_lastError), "GetAudioEffectCtrl returned null");
        return false;
    }
    // GME requires the capture/send path for accompaniment uplink; keep the
    // physical microphone muted in this music-only adapter.
    if (ITMGAudioCtrl* audioCtrl = context->GetAudioCtrl()) {
        audioCtrl->EnableAudioCaptureDevice(true);
        audioCtrl->EnableAudioSend(true);
        audioCtrl->SetMicVolume(0);
    }
    int loopCount = loop ? -1 : 1;
    effectCtrl->StopAccompany(0);
    int ret = effectCtrl->StartAccompany(filePath, true, loopCount, 0);
    if (ret != 0) {
        snprintf(g_lastError, sizeof(g_lastError), "StartAccompany returned: %d", ret);
        return false;
    }
    strncpy(g_currentFile, filePath, sizeof(g_currentFile) - 1);
    g_playing = true;
    g_songFinished = false;
    g_userStopped = false;
    g_lastError[0] = 0;
    LOGI("[GME] Playing: %s (loop=%s)\n", filePath, loop ? "yes" : "no");
    return true;
}

void stopMusic() {
    ITMGContext* context = GetGMEContext();
    if (!context) return;
    ITMGAudioEffectCtrl* effectCtrl = context->GetAudioEffectCtrl();
    if (effectCtrl) {
        g_userStopped = true;
        effectCtrl->StopAccompany(0);
        g_playing = false;
        g_songFinished = false;
        LOGI("[GME] Stopped\n");
    }
}

// Device ids and names come from the Windows audio stack, so both can contain
// quotes, backslashes, or control characters. Escape them before embedding the
// SDK strings in the small JSON protocol used by the Node bridge.
static std::string jsonEscape(const char* value) {
    std::string escaped;
    if (!value) return escaped;
    for (const unsigned char* p = (const unsigned char*)value; *p; ++p) {
        switch (*p) {
            case '\\': escaped += "\\\\"; break;
            case '"': escaped += "\\\""; break;
            case '\b': escaped += "\\b"; break;
            case '\f': escaped += "\\f"; break;
            case '\n': escaped += "\\n"; break;
            case '\r': escaped += "\\r"; break;
            case '\t': escaped += "\\t"; break;
            default:
                if (*p < 0x20) {
                    char control[7];
                    snprintf(control, sizeof(control), "\\u%04x", (unsigned int)*p);
                    escaped += control;
                } else {
                    escaped.push_back((char)*p);
                }
                break;
        }
    }
    return escaped;
}

// ==================== MAIN THREAD: PROCESS COMMANDS ====================

void processCommand(Command* cmd) {
    ITMGContext* ctx = GetGMEContext();

    switch (cmd->type) {
        case CMD_JOIN: {
            g_songFinished = false;
            if (g_inRoom) {
                LOGI("[GME] Leaving current room first...\n");
                ctx->ExitRoom();
                for (int i = 0; i < 20 && g_inRoom; i++) { ctx->Poll(); sleepMs(100); }
            }

            if (!initGME(cmd->user)) {
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"error\":\"GME init failed\",\"lastError\":\"%s\"}", g_lastError);
                break;
            }

            const char* authId = strlen(cmd->uuid) > 0 ? cmd->uuid : cmd->user;
            if (!enterRoom(cmd->room, authId)) {
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"error\":\"EnterRoom failed\",\"lastError\":\"%s\"}", g_lastError);
                break;
            }

            for (int i = 0; i < 100 && !g_inRoom; i++) {
                ctx->Poll();
                sleepMs(100);
            }

            if (g_inRoom) {
                LOGI("[GME] Room entry confirmed\n");
                cmd->success = true;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":true,\"inRoom\":true,\"audioEnabled\":%s}",
                    g_audioEnabled ? "true" : "false");
            } else {
                snprintf(g_lastError, sizeof(g_lastError), "Room entry timeout after 10 seconds");
                LOGE("[GME] %s\n", g_lastError);
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"inRoom\":false,\"error\":\"Room entry timeout\",\"lastError\":\"%s\"}", g_lastError);
            }
            break;
        }

        case CMD_LEAVE: {
            if (g_effectPlaying && ctx && ctx->GetAudioEffectCtrl()) {
                ctx->GetAudioEffectCtrl()->StopEffect(g_effectId);
                ctx->GetAudioEffectCtrl()->EnableEffectSend(g_effectId, false);
                g_effectPlaying = false;
                g_effectId = 0;
            }
            if (g_playing) stopMusic();
            if (ctx && g_inRoom) ctx->ExitRoom();
            g_audioEnabled = false;
            g_songFinished = false;
            g_roomType = 0;
            cmd->success = true;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg), "{\"success\":true}");
            break;
        }

        case CMD_PLAY: {
            bool ok = playMusic(cmd->file, cmd->loop);
            cmd->success = ok;
            const std::string escapedFile = jsonEscape(cmd->file);
            const std::string escapedError = jsonEscape(g_lastError);
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                "{\"success\":%s,\"file\":\"%s\",\"inRoom\":%s,\"lastError\":\"%s\"}",
                ok ? "true" : "false", escapedFile.c_str(),
                g_inRoom ? "true" : "false", escapedError.c_str());
            break;
        }

        case CMD_STOP: {
            // Pre-room controls must not touch an uninitialized GME effect controller.
            if (g_initialized && g_inRoom) stopMusic();
            cmd->success = true;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg), "{\"success\":true}");
            break;
        }

        case CMD_PAUSE: {
            if (g_initialized && g_inRoom && ctx && ctx->GetAudioEffectCtrl()) {
                ctx->GetAudioEffectCtrl()->PauseAccompany();
            }
            cmd->success = true;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg), "{\"success\":true}");
            break;
        }

        case CMD_RESUME: {
            if (g_initialized && g_inRoom && ctx && ctx->GetAudioEffectCtrl()) {
                ctx->GetAudioEffectCtrl()->ResumeAccompany();
            }
            cmd->success = true;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg), "{\"success\":true}");
            break;
        }

        case CMD_VOLUME: {
            const bool canApply = g_initialized && g_inRoom;
            if (canApply) {
                ITMGContext* volumeCtx = GetGMEContext();
                ITMGAudioEffectCtrl* effectCtrl = volumeCtx
                    ? volumeCtx->GetAudioEffectCtrl()
                    : nullptr;
                if (effectCtrl) effectCtrl->SetAccompanyVolume((std::max)(0, (std::min)(100, cmd->volume)));
            }
            cmd->success = true;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                "{\"success\":true,\"vol\":%d,\"applied\":%s}",
                cmd->volume, canApply ? "true" : "false");
            break;
        }

        case CMD_EFFECT_PLAY: {
            ITMGAudioEffectCtrl* effectCtrl = (ctx && g_inRoom) ? ctx->GetAudioEffectCtrl() : nullptr;
            const int effectId = cmd->effectId > 0 ? cmd->effectId : 9001;
            const int volume = (std::max)(0, (std::min)(100, cmd->volume));
            if (!effectCtrl || !cmd->file[0]) {
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"supported\":true,\"error\":\"GME effect controller unavailable or file missing\"}");
                break;
            }

            // Reusing the same id must never leave an earlier speech effect
            // playing underneath the new one. This does not touch the
            // accompaniment/music channel.
            effectCtrl->StopEffect(effectId);
            int ret = effectCtrl->PlayEffect(effectId, cmd->file, false, 1.0, 0.0, volume);
            if (ret != 0) {
                g_effectPlaying = false;
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"supported\":true,\"error\":\"PlayEffect failed\",\"code\":%d}", ret);
                break;
            }

            const int sendRet = effectCtrl->EnableEffectSend(effectId, cmd->effectSend);
            if (sendRet != 0 && cmd->effectSend) {
                effectCtrl->StopEffect(effectId);
                g_effectPlaying = false;
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"supported\":true,\"error\":\"EnableEffectSend failed\",\"code\":%d}", sendRet);
                break;
            }

            g_effectPlaying = true;
            g_effectId = effectId;
            cmd->success = true;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                "{\"success\":true,\"supported\":true,\"effectId\":%d,\"volume\":%d,\"send\":%s}",
                effectId, volume, cmd->effectSend ? "true" : "false");
            break;
        }

        case CMD_EFFECT_STOP: {
            ITMGAudioEffectCtrl* effectCtrl = (ctx && g_inRoom) ? ctx->GetAudioEffectCtrl() : nullptr;
            const int effectId = cmd->effectId > 0 ? cmd->effectId : g_effectId;
            if (effectCtrl && effectId > 0) {
                effectCtrl->StopEffect(effectId);
                effectCtrl->EnableEffectSend(effectId, false);
            }
            if (effectId == g_effectId || effectId <= 0) {
                g_effectPlaying = false;
                g_effectId = 0;
            }
            cmd->success = true;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                "{\"success\":true,\"effectId\":%d}", effectId);
            break;
        }

        case CMD_EFFECT_VOLUME: {
            ITMGAudioEffectCtrl* effectCtrl = (ctx && g_inRoom) ? ctx->GetAudioEffectCtrl() : nullptr;
            const int effectId = cmd->effectId > 0 ? cmd->effectId : g_effectId;
            const int volume = (std::max)(0, (std::min)(100, cmd->volume));
            if (!effectCtrl || effectId <= 0) {
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"error\":\"GME effect controller unavailable\"}");
                break;
            }
            const int ret = effectCtrl->SetEffectVolume(effectId, volume);
            cmd->success = ret == 0;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                "{\"success\":%s,\"effectId\":%d,\"volume\":%d,\"code\":%d}",
                ret == 0 ? "true" : "false", effectId, volume, ret);
            break;
        }

        case CMD_ROOM_TYPE: {
            if (!ctx || !g_inRoom || !ctx->GetRoom()) {
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"error\":\"Not in GME room\"}");
                break;
            }
            if (cmd->roomType != ITMG_ROOM_TYPE_FLUENCY &&
                cmd->roomType != ITMG_ROOM_TYPE_STANDARD &&
                cmd->roomType != ITMG_ROOM_TYPE_HIGHQUALITY) {
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"error\":\"Invalid room quality\"}");
                break;
            }
            ITMGRoom* room = ctx->GetRoom();
            int ret = -1;
            const bool changed = changeRoomTypeAndWait(ctx, room, cmd->roomType, 5000, &ret);
            if (!changed) {
                cmd->success = false;
                snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                    "{\"success\":false,\"error\":\"ChangeRoomType failed\",\"code\":%d,\"roomType\":%d,\"roomQuality\":\"%s\"}",
                    ret, (int)g_roomType, roomTypeName(g_roomType));
                break;
            }
            int current = room->GetRoomType();
            g_roomType = current > 0 ? current : cmd->roomType;
            cmd->success = true;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg),
                "{\"success\":true,\"roomType\":%d,\"roomQuality\":\"%s\"}",
                (int)g_roomType, roomTypeName(g_roomType));
            LOGE("[GME] Room quality set to %s (type=%d)\n", roomTypeName(g_roomType), (int)g_roomType);
            break;
        }

        default:
            cmd->success = false;
            snprintf(cmd->resultMsg, sizeof(cmd->resultMsg), "{\"error\":\"unknown command\"}");
            break;
    }
}

// ==================== HTTP SERVER (BACKGROUND THREAD, Winsock) ====================

bool submitCommandAndWait(CmdType type, int timeoutMs = 20000) {
    g_cmd.type = type;
    g_cmd.done = false;
    g_cmd.success = false;
    g_cmd.resultMsg[0] = 0;
    g_cmd.pending = true;

    int waited = 0;
    while (!g_cmd.done && waited < timeoutMs) {
        sleepMs(50);
        waited += 50;
    }

    if (!g_cmd.done) {
        snprintf(g_cmd.resultMsg, sizeof(g_cmd.resultMsg),
            "{\"success\":false,\"error\":\"Command timeout after %dms\"}", timeoutMs);
        g_cmd.pending = false;
        return false;
    }
    return g_cmd.success;
}

static void extractStr(const char* body, const char* key, char* out, size_t outLen) {
    if (!out || outLen == 0) return;
    out[0] = 0;
    if (!body || !key) return;
    char searchKey[64];
    snprintf(searchKey, sizeof(searchKey), "\"%s\"", key);
    const char* ptr = strstr(body, searchKey);
    if (!ptr) return;
    ptr = strchr(ptr + strlen(searchKey), '"');
    if (!ptr) return;
    ptr++;
    const char* end = strchr(ptr, '"');
    if (!end) return;
    size_t written = 0;
    for (const char* cursor = ptr; cursor < end && written + 1 < outLen; cursor++) {
        if (*cursor == '\\' && cursor + 1 < end) {
            cursor++;
            if (*cursor == 'n') out[written++] = '\n';
            else if (*cursor == 'r') out[written++] = '\r';
            else if (*cursor == 't') out[written++] = '\t';
            else out[written++] = *cursor;
        } else {
            out[written++] = *cursor;
        }
    }
    out[written] = 0;
}

static int extractInt(const char* body, const char* key, int fallback = 0) {
    if (!body || !key) return fallback;
    char searchKey[64];
    snprintf(searchKey, sizeof(searchKey), "\"%s\"", key);
    const char* ptr = strstr(body, searchKey);
    if (!ptr) return fallback;
    ptr = strchr(ptr + strlen(searchKey), ':');
    return ptr ? atoi(ptr + 1) : fallback;
}

static void sendHttpResponse(SOCKET clientFd, const char* response) {
    if (!response) {
        closesocket(clientFd);
        return;
    }

    // The old server relied on the peer noticing the socket close to delimit
    // the body.  That works with curl, but Node/axios can report ECONNRESET
    // when a keep-alive connection is closed without an explicit length.
    // Re-frame every response with standard HTTP/1.1 headers so the control
    // client can reliably consume /join, /volume, etc.
    const char* separator = strstr(response, "\r\n\r\n");
    if (!separator) {
        send(clientFd, response, (int)strlen(response), 0);
        closesocket(clientFd);
        return;
    }

    const size_t headerLen = (size_t)(separator - response);
    const char* body = separator + 4;
    const size_t bodyLen = strlen(body);
    char headers[4096] = {0};
    int headerBytes = snprintf(headers, sizeof(headers),
        "%.*s\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n",
        (int)headerLen, response, bodyLen);
    if (headerBytes > 0) send(clientFd, headers, headerBytes, 0);
    if (bodyLen > 0) send(clientFd, body, (int)bodyLen, 0);
    closesocket(clientFd);
}

void handleHTTPRequest(SOCKET clientFd) {
    char buffer[4096] = {0};
    int bytesRead = recv(clientFd, buffer, sizeof(buffer) - 1, 0);
    if (bytesRead <= 0) { closesocket(clientFd); return; }

    // recv() is allowed to return only the headers (or only part of the
    // body).  Read the declared Content-Length before parsing JSON; otherwise
    // /volume silently falls back to 100 and /join can lose its room/user.
    int contentLength = 0;
    while (true) {
        buffer[bytesRead] = 0;
        char* headerEnd = strstr(buffer, "\r\n\r\n");
        if (headerEnd) {
            char* lengthHeader = strstr(buffer, "Content-Length:");
            if (lengthHeader) contentLength = atoi(lengthHeader + 15);
            const int headerBytes = (int)((headerEnd + 4) - buffer);
            const int expectedBytes = headerBytes + (contentLength > 0 ? contentLength : 0);
            if (bytesRead >= expectedBytes || bytesRead >= (int)sizeof(buffer) - 1) break;
            int more = recv(clientFd, buffer + bytesRead,
                (int)sizeof(buffer) - 1 - bytesRead, 0);
            if (more <= 0) break;
            bytesRead += more;
            continue;
        }
        if (bytesRead >= (int)sizeof(buffer) - 1) break;
        int more = recv(clientFd, buffer + bytesRead,
            (int)sizeof(buffer) - 1 - bytesRead, 0);
        if (more <= 0) break;
        bytesRead += more;
    }
    buffer[bytesRead] = 0;

    if (!gmeAdapterRequestAuthorized(buffer)) {
        sendHttpResponse(clientFd,
            "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nWWW-Authenticate: GME-Adapter\r\n\r\n"
            "{\"ok\":false,\"error\":\"Invalid GME adapter token\"}");
        return;
    }

    char method[16] = {0}, path[256] = {0};
    sscanf(buffer, "%15s %255s", method, path);
    LOGI("[HTTP] %s %s\n", method, path);

    const char* musicEndpoints[] = {"/status", "/health", "/capabilities", "/join", "/play", "/stop", "/pause", "/resume", "/volume", "/effect-play", "/effect-stop", "/effect-volume", "/room-quality", "/leave"};
    bool supportedEndpoint = false;
    for (const char* endpoint : musicEndpoints) {
        if (strcmp(path, endpoint) == 0) { supportedEndpoint = true; break; }
    }
    if (!supportedEndpoint) {
        sendHttpResponse(clientFd,
            "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\n\r\n"
            "{\"error\":\"unknown music adapter endpoint\"}");
        return;
    }

    char* body = strstr(buffer, "\r\n\r\n");
    if (body) body += 4;

    char response[32768] = {0};
    const std::string escapedBotId = jsonEscape(g_botId);

    if (strcmp(path, "/capabilities") == 0) {
        const bool authenticated = !gmeAdapterAuthRequired() || !gmeAdapterExpectedToken().empty();
        snprintf(response, sizeof(response),
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
            "{\"botId\":\"%s\",\"adapter\":\"windows-native\",\"protocolVersion\":4,\"sdkVersion\":\"2.9.15\",\"authenticated\":%s,"
            "\"features\":{\"status\":true,\"health\":true,\"playMusic\":true,\"effects\":true,\"roomQuality\":true},"
            "\"endpoints\":[\"/status\",\"/health\",\"/capabilities\",\"/join\",\"/play\",\"/stop\",\"/pause\",\"/resume\",\"/volume\",\"/effect-play\",\"/effect-stop\",\"/effect-volume\",\"/room-quality\",\"/leave\"]} ",
            escapedBotId.c_str(), authenticated ? "true" : "false");
    }
    else if (strcmp(path, "/health") == 0) {
        const long long nowMs = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        const std::string escapedError = jsonEscape(g_lastError);
        snprintf(response, sizeof(response),
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
            "{\"botId\":\"%s\",\"adapter\":\"windows-native\",\"state\":\"%s\",\"reachable\":true,\"initialized\":%s,\"inRoom\":%s,\"playing\":%s,\"audioEnabled\":%s,\"reconnecting\":false,\"lastError\":\"%s\",\"observedAtMs\":%lld}",
            escapedBotId.c_str(), g_inRoom ? "ready" : "idle", g_initialized ? "true" : "false", g_inRoom ? "true" : "false",
            g_playing ? "true" : "false", g_audioEnabled ? "true" : "false",
            escapedError.c_str(), nowMs);
    }
    else if (strcmp(path, "/status") == 0) {
        const std::string escapedRoom = jsonEscape(g_roomId);
        const std::string escapedFile = jsonEscape(g_currentFile);
        const std::string escapedError = jsonEscape(g_lastError);
        snprintf(response, sizeof(response),
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
            "{\"sdkLoaded\":true,\"initialized\":%s,\"inRoom\":%s,\"playing\":%s,"
            "\"songFinished\":%s,\"currentFile\":\"%s\",\"file\":\"%s\",\"room\":\"%s\","
            "\"audioEnabled\":%s,\"roomType\":%d,\"roomQuality\":\"%s\",\"lastError\":\"%s\"}",
            g_initialized ? "true" : "false",
            g_inRoom ? "true" : "false",
            g_playing ? "true" : "false",
            g_songFinished ? "true" : "false", escapedFile.c_str(), escapedFile.c_str(), escapedRoom.c_str(),
            g_audioEnabled ? "true" : "false", (int)g_roomType, roomTypeName(g_roomType), escapedError.c_str());
    }
    else if (strcmp(path, "/join") == 0 && body) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        extractStr(body, "room", g_cmd.room, sizeof(g_cmd.room));
        extractStr(body, "user", g_cmd.user, sizeof(g_cmd.user));
        extractStr(body, "uuid", g_cmd.uuid, sizeof(g_cmd.uuid));

        LOGI("[GME] /join requested\n");

        if (strlen(g_cmd.room) > 0 && strlen(g_cmd.user) > 0) {
            submitCommandAndWait(CMD_JOIN, 20000);
            int status = g_cmd.success ? 200 : 500;
            snprintf(response, sizeof(response),
                "HTTP/1.1 %d %s\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
                status, status == 200 ? "OK" : "Internal Server Error", g_cmd.resultMsg);
        } else {
            snprintf(response, sizeof(response),
                "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
                "{\"error\":\"need room and user. Optional: uuid for auth.\"}");
        }
    }
    else if (strcmp(path, "/play") == 0 && body) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        extractStr(body, "file", g_cmd.file, sizeof(g_cmd.file));
        g_cmd.loop = (strstr(body, "\"loop\":false") == NULL);

        if (strlen(g_cmd.file) > 0) {
            submitCommandAndWait(CMD_PLAY, 5000);
            snprintf(response, sizeof(response),
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
                g_cmd.resultMsg);
        } else {
            snprintf(response, sizeof(response),
                "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
                "{\"error\":\"need file path\"}");
        }
    }
    else if (strcmp(path, "/stop") == 0) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        submitCommandAndWait(CMD_STOP, 5000);
        snprintf(response, sizeof(response),
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
            g_cmd.resultMsg);
    }
    else if (strcmp(path, "/pause") == 0) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        submitCommandAndWait(CMD_PAUSE, 5000);
        snprintf(response, sizeof(response),
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
            g_cmd.resultMsg);
    }
    else if (strcmp(path, "/resume") == 0) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        submitCommandAndWait(CMD_RESUME, 5000);
        snprintf(response, sizeof(response),
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
            g_cmd.resultMsg);
    }
    else if (strcmp(path, "/volume") == 0 && body) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        g_cmd.volume = 100;
        char* volPtr = strstr(body, "\"vol\"");
        if (volPtr) sscanf(volPtr, "\"vol\":%d", &g_cmd.volume);
        submitCommandAndWait(CMD_VOLUME, 5000);
        snprintf(response, sizeof(response),
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
            g_cmd.resultMsg);
    }
    else if (strcmp(path, "/effect-play") == 0 && body) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        extractStr(body, "file", g_cmd.file, sizeof(g_cmd.file));
        g_cmd.effectId = extractInt(body, "effectId", 9001);
        g_cmd.volume = extractInt(body, "volume", 100);
        g_cmd.effectSend = strstr(body, "\"send\":false") == NULL;
        if (!g_cmd.file[0]) {
            snprintf(response, sizeof(response),
                "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
                "{\"success\":false,\"error\":\"need file path\"}");
        } else {
            submitCommandAndWait(CMD_EFFECT_PLAY, 5000);
            snprintf(response, sizeof(response),
                "HTTP/1.1 %d %s\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
                g_cmd.success ? 200 : 409, g_cmd.success ? "OK" : "Conflict", g_cmd.resultMsg);
        }
    }
    else if (strcmp(path, "/effect-stop") == 0) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        g_cmd.effectId = extractInt(body, "effectId", 0);
        submitCommandAndWait(CMD_EFFECT_STOP, 5000);
        snprintf(response, sizeof(response),
            "HTTP/1.1 %d %s\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
            g_cmd.success ? 200 : 409, g_cmd.success ? "OK" : "Conflict", g_cmd.resultMsg);
    }
    else if (strcmp(path, "/effect-volume") == 0 && body) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        g_cmd.effectId = extractInt(body, "effectId", 9001);
        g_cmd.volume = extractInt(body, "volume", 100);
        submitCommandAndWait(CMD_EFFECT_VOLUME, 5000);
        snprintf(response, sizeof(response),
            "HTTP/1.1 %d %s\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
            g_cmd.success ? 200 : 409, g_cmd.success ? "OK" : "Conflict", g_cmd.resultMsg);
    }
    else if (strcmp(path, "/room-quality") == 0 && body) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        char quality[32] = {0};
        extractStr(body, "quality", quality, sizeof(quality));
        g_cmd.roomType = parseRoomType(quality);
        if (!g_cmd.roomType) {
            snprintf(response, sizeof(response),
                "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
                "{\"success\":false,\"error\":\"quality must be fluency, standard, or highquality\"}");
        } else {
            submitCommandAndWait(CMD_ROOM_TYPE, 5000);
            snprintf(response, sizeof(response),
                "HTTP/1.1 %d %s\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
                g_cmd.success ? 200 : 409, g_cmd.success ? "OK" : "Conflict", g_cmd.resultMsg);
        }
    }
    else if (strcmp(path, "/leave") == 0) {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        memset(&g_cmd, 0, sizeof(g_cmd));
        submitCommandAndWait(CMD_LEAVE, 5000);
        snprintf(response, sizeof(response),
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n%s",
            g_cmd.resultMsg);
    }
    else {
        snprintf(response, sizeof(response),
            "HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n"
            "{\"endpoints\":[\"/status\",\"/health\",\"/capabilities\",\"/join\",\"/play\",\"/stop\",\"/pause\",\"/resume\",\"/volume\",\"/effect-play\",\"/effect-stop\",\"/effect-volume\",\"/room-quality\",\"/leave\"]}");
    }

    LOGI("[HTTP] Sending response body-framed\n");
    sendHttpResponse(clientFd, response);
}

void httpServerThread() {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        LOGE("WSAStartup failed\n");
        return;
    }

    SOCKET serverFd = socket(AF_INET, SOCK_STREAM, 0);
    BOOL opt = TRUE;
    setsockopt(serverFd, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    struct sockaddr_in addr;
    addr.sin_family = AF_INET;
    // The control plane is private and should only be reachable through
    // bot-server. The adapter token is defense in depth, not a reason to bind
    // a GME control port to the LAN.
    InetPtonA(AF_INET, "127.0.0.1", &addr.sin_addr);
    addr.sin_port = htons((u_short)g_httpPort);

    if (bind(serverFd, (struct sockaddr*)&addr, sizeof(addr)) != 0) {
        LOGE("HTTP bind failed on port %d\n", g_httpPort);
        return;
    }
    listen(serverFd, 5);
    printf("HTTP server listening on port %d\n", g_httpPort); fflush(stdout);

    while (g_running) {
        SOCKET clientFd = accept(serverFd, NULL, NULL);
        if (clientFd != INVALID_SOCKET) handleHTTPRequest(clientFd);
    }
    closesocket(serverFd);
    WSACleanup();
}

// ==================== SIGNAL HANDLER ====================

void signalHandler(int sig) {
    printf("\nShutting down...\n"); fflush(stdout);
    g_running = false;
    if (g_playing) stopMusic();
    ITMGContext* ctx = GetGMEContext();
    if (ctx) {
        if (g_inRoom) ctx->ExitRoom();
        ctx->Uninit();
    }
    exit(0);
}

// ==================== MAIN ====================

int main(int argc, char* argv[]) {
    signal(SIGINT, signalHandler);
    signal(SIGTERM, signalHandler);

    // Parse local adapter runtime options.
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--port") == 0 && i + 1 < argc) {
            g_httpPort = atoi(argv[++i]);
        } else if (strcmp(argv[i], "--bot-id") == 0 && i + 1 < argc) {
            strncpy(g_botId, argv[++i], sizeof(g_botId) - 1);
        } else if (strcmp(argv[i], "--verbose") == 0) {
            g_verbose = true;
        }
    }

    if (!loadGmeCredentials()) {
        fprintf(stderr, "GME_SDK_APP_ID and a 16-byte GME_SDK_KEY are required in the local environment\n");
        return 2;
    }

    printf("GME Music Bot for YelloTalk (Windows native)\n");
    printf("   GME credentials: external environment\n");
    printf("   HTTP Control: http://127.0.0.1:%d (token protected)\n", g_httpPort);
    if (g_botId[0]) printf("   Bot ID: %s\n", g_botId);
    printf("   SDK: linked directly against gmesdk.lib\n\n");
    fflush(stdout);

    // Start HTTP server FIRST (so /status works even if SDK fails)
    std::thread httpThread(httpServerThread);
    httpThread.detach();

    printf("Waiting for HTTP commands...\n"); fflush(stdout);
    // ==================== MAIN LOOP ====================
    while (g_running) {
        ITMGContext* ctx = GetGMEContext();
        if (ctx) ctx->Poll();

        if (g_cmd.pending) {
            g_cmd.pending = false;
            LOGI("[Main] Processing command type=%d\n", g_cmd.type);
            processCommand(&g_cmd);
            g_cmd.done = true;
        }

        sleepMs(33);
    }

    return 0;
}
