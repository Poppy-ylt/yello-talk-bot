#pragma once
#if defined(_WIN32) || defined(__ORBIS__)
#ifdef _GMESDK_IMPLEMENT_
#define AV_EXPORT __declspec(dllexport)
#else
#define AV_EXPORT __declspec(dllimport)
#endif
#define QAVSDK_API extern "C" AV_EXPORT
#define QAVSDK_CALL __cdecl
#define __UNUSED
#else
#define QAVSDK_API extern "C"  __attribute__ ((visibility("default")))
#define QAVSDK_CALL
#define __UNUSED __attribute__((unused))
#endif

typedef enum {
    ITMG_PERMISSION_GRANTED = 0,
    ITMG_PERMISSION_Denied = 1,
    ITMG_PERMISSION_NotDetermined = 2,
    ITMG_PERMISSION_ERROR = 3,
}ITMG_RECORD_PERMISSION;

typedef enum {
    ITMG_CHECK_MIC_STATUS_AVAILABLE = 0,
    ITMG_CHECK_MIC_STATUS_ERROR_FUNC = 1,
    ITMG_CHECK_MIC_STATUS_NO_GRANTED = 2,
    ITMG_CHECK_MIC_STATUS_INVALID_MIC = 3,
    ITMG_CHECK_MIC_STATUS_JNI_ERROR = 4,
    ITMG_CHECK_MIC_STATUS_NOT_INIT = 5,
}ITMG_CHECK_MIC_STATUS;

typedef enum {
	ITMG_ROOM_TYPE_FLUENCY = 1,
	ITMG_ROOM_TYPE_STANDARD = 2,
	ITMG_ROOM_TYPE_HIGHQUALITY = 3,
}ITMG_ROOM_TYPE;

typedef enum {
    ITMG_REALTIME_ASR_START = 0,
    ITMG_REALTIME_ASR_CONTENT = 1,
    ITMG_REALTIME_ASR_END = 2,
}ITMG_REALTIME_ASR_SUBEVENT;


typedef enum {
	ITMG_ROOM_CHANGE_EVENT_ENTERROOM = 1,
	ITMG_ROOM_CHANGE_EVENT_START = 2,
	ITMG_ROOM_CHANGE_EVENT_COMPLETE = 3,
	ITMG_ROOM_CHANGE_EVENT_REQUEST = 4
}ITMG_ROOM_TYPE_SUB_EVENT;

typedef ITMG_ROOM_TYPE_SUB_EVENT ITMG_ROOM_CHANGE_EVENT;/*ITMG_ROOM_CHANGE_EVENT is deprecated*/
/*
 *	//TMG event enumeration that from a callback event
 */
typedef enum {
    ITMG_MAIN_EVENT_TYPE_NONE = 0,

    //Notification of entering a room, triggered by EnterRoom API.
    ITMG_MAIN_EVENT_TYPE_ENTER_ROOM = 1,
    //Notification of exiting a room, triggered by ExitRoom API.
    ITMG_MAIN_EVENT_TYPE_EXIT_ROOM = 2,
    //Notification of room disconnection due to network or other reasons, which will trigger automatically.
    ITMG_MAIN_EVENT_TYPE_ROOM_DISCONNECT = 3,
    //Notification of the updates of room members, the notification contains detailed information, refer to ITMG_EVENT_ID_USER_UPDATE.
    ITMG_MAIN_EVNET_TYPE_USER_UPDATE = 4,

    ITMG_MAIN_EVENT_TYPE_NUMBER_OF_USERS_UPDATE = 7,// number of users in current room
    ITMG_MAIN_EVENT_TYPE_NUMBER_OF_AUDIOSTREAMS_UPDATE = 8,// number of audioStreams in current room
    //Notification of room reconnection happened, which indicates services will be temporarily unavailable.
    ITMG_MAIN_EVENT_TYPE_RECONNECT_START = 11,
    //Notification of room reconnection succeeded, which indicates services have recovered.
    ITMG_MAIN_EVENT_TYPE_RECONNECT_SUCCESS = 12,
	//Notification of switching a room, triggered by SwitchRoom API.
	ITMG_MAIN_EVENT_TYPE_SWITCH_ROOM = 13,
    //Notification of RoomType have been Changed by Other EndUser
    ITMG_MAIN_EVENT_TYPE_CHANGE_ROOM_TYPE = 21,

    ITMG_MAIN_EVENT_TYPE_AUDIO_DATA_EMPTY = 22,

    ITMG_MAIN_EVENT_TYPE_ROOM_SHARING_START = 23,
    ITMG_MAIN_EVENT_TYPE_ROOM_SHARING_STOP = 24,

	ITMG_MAIN_EVENT_TYPE_RECORD_COMPLETED = 30,
	ITMG_MAIN_EVENT_TYPE_RECORD_PREVIEW_COMPLETED = 31,
	ITMG_MAIN_EVENT_TYPE_RECORD_MIX_COMPLETED = 32,

    ITMG_MAIN_EVENT_TYPE_AUDIOROUTE_UPDATE = 33,
    //detect iOS mute switch
    ITMG_MAIN_EVENT_TYPE_IOS_MUTE_SWITCH_RESULT = 34,

	//Notify user the default speaker device is changed in the PC, refresh the Speaker devices when you recv this event.
	ITMG_MAIN_EVENT_TYPE_SPEAKER_DEFAULT_DEVICE_CHANGED = 1008,
	//Notify user new Speaker device in the PC, refresh the Speaker devices when you recv this event.
	ITMG_MAIN_EVENT_TYPE_SPEAKER_NEW_DEVICE = 1009,
	//Notify user speaker device lost from the PC, refresh the Speaker devices when you recv this event.
	ITMG_MAIN_EVENT_TYPE_SPEAKER_LOST_DEVICE = 1010,
	//Notify user new mic device in the PC, refresh the Speaker devices when you recv this event.
	ITMG_MAIN_EVENT_TYPE_MIC_NEW_DEVICE = 1011,
	//Notify user mic device lost from the PC, refresh the Speaker devices when you recv this event.
	ITMG_MAIN_EVENT_TYPE_MIC_LOST_DEVICE = 1012,
	//Notify user the default mic device is changed in the PC, refresh the mic devices when you recv this event.
	ITMG_MAIN_EVENT_TYPE_MIC_DEFAULT_DEVICE_CHANGED = 1013,

	ITMG_MAIN_EVENT_TYPE_AUDIO_ROUTE_CHANGED = 1014,

	//Notification of volumes of users in room
	ITMG_MAIN_EVENT_TYPE_USER_VOLUMES = 1020,

	//quality information
	ITMG_MAIN_EVENT_TYPE_CHANGE_ROOM_QUALITY = 1022,

	//Notification of accompany finished
	ITMG_MAIN_EVENT_TYPE_ACCOMPANY_FINISH = 1090,

    //Notification of Server Audio Route Event
    ITMG_MAIN_EVENT_TYPE_SERVER_AUDIO_ROUTE_EVENT = 1091,

    //Notification of Custom Audio Data
    ITMG_MAIN_EVENT_TYPE_CUSTOMDATA_UPDATE = 1092,

    ITMG_MAIN_EVENT_TYPE_REALTIME_ASR = 1093,

    ITMG_MAIN_EVENT_TYPE_CHORUS_EVENT = 1094,

    ITMG_MAIN_EVENT_TYPE_CHANGETEAMID = 1095,

	ITMG_MAIN_EVENT_TYPE_AGE_DETECTED = 1096,

	ITMG_MAIN_EVNET_TYPE_AUDIO_READY = 2000,

    ITMG_MAIN_EVENT_TYPE_HARDWARE_TEST_RECORD_FINISH = 2001,

    ITMG_MAIN_EVENT_TYPE_HARDWARE_TEST_PREVIEW_FINISH = 2002,

	// Notification of PTT Record
	ITMG_MAIN_EVNET_TYPE_PTT_RECORD_COMPLETE = 5001,
	// Notification of PTT Upload
    ITMG_MAIN_EVNET_TYPE_PTT_UPLOAD_COMPLETE = 5002,
	// Notification of PTT Download
    ITMG_MAIN_EVNET_TYPE_PTT_DOWNLOAD_COMPLETE = 5003,
	// Notification of PTT Play
    ITMG_MAIN_EVNET_TYPE_PTT_PLAY_COMPLETE = 5004,
	// Notification of PTT 2Text
    ITMG_MAIN_EVNET_TYPE_PTT_SPEECH2TEXT_COMPLETE = 5005,
    // Notification of StreamRecognition
    ITMG_MAIN_EVNET_TYPE_PTT_STREAMINGRECOGNITION_COMPLETE = 5006,
    //Notification of StreamRecognition intermediate result
    ITMG_MAIN_EVNET_TYPE_PTT_STREAMINGRECOGNITION_IS_RUNNING = 5007,
    ITMG_MAIN_EVNET_TYPE_PTT_TEXT2SPEECH_COMPLETE = 5008,

    // Notification of PTT TranslateText
    ITMG_MAIN_EVNET_TYPE_PTT_TRANSLATE_TEXT_COMPLETE = 5009,
    ITMG_MAIN_EVNET_TYPE_ROOM_MANAGEMENT_OPERATOR = 6000,

    ITMG_MAIN_EVENT_TYPE_MIX_SYSTEM_AUDIO_TO_SEND_START = 6001,
    ITMG_MAIN_EVENT_TYPE_MIX_SYSTEM_AUDIO_TO_SEND_STOP = 6002,

	// voice Changer
    ITMG_MAIN_EVNET_TYPE_VOICE_CHANGER_FETCH_COMPLETE = 7000,
} ITMG_MAIN_EVENT_TYPE;

typedef enum {
    //operator
    ITMG_ROOM_MANAGEMENT_CAPTURE_OP = 0,
    ITMG_ROOM_MANAGEMENT_PLAY_OP = ITMG_ROOM_MANAGEMENT_CAPTURE_OP + 1,
    ITMG_ROOM_MANAGEMENT_AUDIO_SEND_OP = ITMG_ROOM_MANAGEMENT_PLAY_OP + 1,
    ITMG_ROOM_MANAGEMENT_AUDIO_REC_OP = ITMG_ROOM_MANAGEMENT_AUDIO_SEND_OP + 1,
    ITMG_ROOM_MANAGEMENT_MIC_OP = ITMG_ROOM_MANAGEMENT_AUDIO_REC_OP + 1,
    ITMG_ROOM_MANAGEMENT_SPEAKER_OP = ITMG_ROOM_MANAGEMENT_MIC_OP + 1,
    ITMG_ROOM_MANAGEMENT_GET_MIC_STATE = ITMG_ROOM_MANAGEMENT_SPEAKER_OP + 1,
    ITMG_ROOM_MANAGEMENT_GET_SPEAKER_STATE = ITMG_ROOM_MANAGEMENT_GET_MIC_STATE + 1,
    ITMG_ROOM_MANAGERMENT_FOBIN_OP = ITMG_ROOM_MANAGEMENT_GET_SPEAKER_STATE + 1,

}ROOM_MANAGEMENT_OPERATOR;

typedef enum {
    AUDIO_ROUTE_SEND_INQUIRE_ERROR = 0,
    AUDIO_ROUTE_NOT_SEND_TO_ANYONE = 1,
    AUDIO_ROUTE_SEND_TO_ALL = AUDIO_ROUTE_NOT_SEND_TO_ANYONE + 1,
    AUDIO_ROUTE_SEND_BLACK_LIST = AUDIO_ROUTE_SEND_TO_ALL + 1,
    AUDIO_ROUTE_SEND_WHITE_LIST = AUDIO_ROUTE_SEND_BLACK_LIST + 1,
}ITMG_SERVER_AUDIO_ROUTE_SEND_TYPE;

typedef enum {
    ITMG_MAIN_EVENT_TYPE_CHORUS_SUB_EVENT_HAS_NO_CMD_PACK = 1,
    ITMG_MAIN_EVENT_TYPE_CHORUS_SUB_EVENT_HAS_CMD_PACK = 2,
    ITMG_MAIN_EVENT_TYPE_CHORUS_SUB_EVENT_START = 3,
    ITMG_MAIN_EVENT_TYPE_CHORUS_SUB_EVENT_STOP = 6,
    ITMG_MAIN_EVENT_TYPE_CHORUS_SUB_EVENT_ACCOMPANIER_OPTION = 7,
    ITMG_MAIN_EVENT_TYPE_CHORUS_SUB_EVENT_STATUS_REFUSE  = 9 ,
    ITMG_MAIN_EVENT_TYPE_CHORUS_SUB_EVENT_STOP_BY_PEER = 10,
}ITMG_MAIN_EVENT_TYPE_CHORUS_SUB_EVENT;

typedef enum {
    ITMG_CUSTOMDATA_AV_SUB_EVENT_UPDATE = 0,
}ITMG_CUSTOMDATA_SUB_EVENT;




typedef enum {
    AUDIO_ROUTE_RECV_INQUIRE_ERROR = 0,
    AUDIO_ROUTE_NOT_RECV_FROM_ANYONE = 1,
    AUDIO_ROUTE_RECV_FROM_ALL = AUDIO_ROUTE_NOT_RECV_FROM_ANYONE + 1,
    AUDIO_ROUTE_RECV_BLACK_LIST = AUDIO_ROUTE_RECV_FROM_ALL + 1,
    AUDIO_ROUTE_RECV_WHITE_LIST = AUDIO_ROUTE_RECV_BLACK_LIST + 1,
}ITMG_SERVER_AUDIO_ROUTE_RECV_TYPE;

enum AVServerAudioRouteSubEventType {
    AV_SUB_EVENT_SERVER_AUDIO_ROUTE_UPDATE = 0,
};


/*
 *	Correspond to ITMG_MAIN_EVENT_TYPE::ITMG_MAIN_EVNET_TYPE_USER_UPDATE//correspond,ITMG_MAIN_EVENT_TYPE::ITMG_MAIN_EVNET_TYPE_USER_UPDATE
 *  Details of the enumeration
 */
typedef enum {
	//Notification of entering a room
	ITMG_EVENT_ID_USER_ENTER = 1,
	//Notification of exiting a room
	ITMG_EVENT_ID_USER_EXIT = 2,

	//Notification of member audio event
	ITMG_EVENT_ID_USER_HAS_AUDIO = 5,
	//Notification of no member audio event is received for 2 seconds
	ITMG_EVENT_ID_USER_NO_AUDIO = 6,

	// Notification of some member opens his mic
	ITMG_EVENT_ID_USER_MIC_OPENED = 11,
	// Notification of some member closes his mic
	ITME_EVENT_ID_USER_MIC_CLOSED = 12,
} ITMG_EVENT_ID_USER_UPDATE;
typedef ITMG_EVENT_ID_USER_UPDATE ITMG_EVENT_ID_USER;/*ITMG_EVENT_ID_USER is deprecated*/

typedef	enum {
	//Do not print the log
	TMG_LOG_LEVEL_NONE	  = -1, /*deprecated */
	ITMG_LOG_LEVEL_NONE	  = -1,
	//Used for critical log
	TMG_LOG_LEVEL_ERROR   = 1,/*deprecated */
	ITMG_LOG_LEVEL_ERROR   = 1,
	//Used to prompt for information
	TMG_LOG_LEVEL_INFO    = 2,/*deprecated */
	ITMG_LOG_LEVEL_INFO    = 2,
	//For development and debugging
	TMG_LOG_LEVEL_DEBUG   = 3,/*deprecated */
	ITMG_LOG_LEVEL_DEBUG   = 3,
	//For high-frequency printing information
	TMG_LOG_LEVEL_VERBOSE = 4,/*deprecated */
	ITMG_LOG_LEVEL_VERBOSE = 4,
} ITMG_LOG_LEVEL;

#define DEVICEID_DEFAULT "0"
/*
 *voice change types,
 */
typedef enum {
    ITMG_VOICE_TYPE_ORIGINAL_SOUND = 0,
    ITMG_VOICE_TYPE_LOLITA = 1,
    ITMG_VOICE_TYPE_UNCLE = 2,
	ITMG_VOICE_TYPE_INTANGIBLE = 3,
	ITMG_VOICE_TYPE_DEAD_FATBOY = 4,
    ITMG_VOICE_TYPE_HEAVY_MENTAL = 5,
	ITMG_VOICE_TYPE_DIALECT = 6,
	ITMG_VOICE_TYPE_INFLUENZA = 7,
	ITMG_VOICE_TYPE_CAGED_ANIMAL = 8,
    ITMG_VOICE_TYPE_HEAVY_MACHINE = 9,
    ITMG_VOICE_TYPE_STRONG_CURRENT = 10,
	ITMG_VOICE_TYPE_KINDER_GARTEN = 11,
	ITMG_VOICE_TYPE_HUANG = 12,
	ITMG_VOICE_TYPE_COUNT,
} ITMG_VOICE_TYPE;

typedef enum {
	ITMG_KARAOKE_TYPE_ORIGINAL = 0,
	ITMG_KARAOKE_TYPE_POP = 1,
	ITMG_KARAOKE_TYPE_ROCK = 2,
	ITMG_KARAOKE_TYPE_RB = 3,
	ITMG_KARAOKE_TYPE_DANCE = 4,
	ITMG_KARAOKE_TYPE_HEAVEN = 5,
	ITMG_KARAOKE_TYPE_TTS = 6,
	ITMG_KARAOKE_TYPE_VIGOROUS = 7,
	ITMG_KARAOKE_TYPE_LIMPID = 8,
	ITMG_KARAOKE_TYPE_COUNT,
} ITMG_KARAOKE_TYPE;

typedef enum
{
	ITMG_RANGE_AUDIO_MODE_WORLD = 0x0,
	ITMG_RANGE_AUDIO_MODE_TEAM = 0x1,
    ITMG_RANGE_AUDIO_MODE_SND_TEAM_REC_TEAM = 100,
    ITMG_RANGE_AUDIO_MODE_SND_TEAM_REC_PROX = 101,
    ITMG_RANGE_AUDIO_MODE_SND_TEAM_REC_BOTH = 102,
    ITMG_RANGE_AUDIO_MODE_SND_PROX_REC_TEAM = 103,
    ITMG_RANGE_AUDIO_MODE_SND_PROX_REC_PROX = 104,
    ITMG_RANGE_AUDIO_MODE_SND_PROX_REC_BOTH = 105,
    ITMG_RANGE_AUDIO_MODE_SND_BOTH_REC_BOTH = 106,
    ITMG_RANGE_AUDIO_MODE_SND_BOTH_REC_TEAM = 107,
} ITMG_RANGE_AUDIO_MODE;

typedef enum {
    ITMG_AUDIO_MEMBER_ROLE_ANCHOR = 0x0,
    ITMG_AUDIO_MEMBER_ROLE_AUDIENCE = 0x1,
} ITMG_AUDIO_MEMBER_ROLE;

typedef struct _tag_ITMG_VOICE_TYPE_EQUALIZER
{
	float EQUALIZER_32HZ;               // [-12.0 ~ 12.0]
	float EQUALIZER_64HZ;               // [-12.0 ~ 12.0]
	float EQUALIZER_128HZ;              // [-12.0 ~ 12.0]
	float EQUALIZER_250HZ;              // [-12.0 ~ 12.0]
	float EQUALIZER_500HZ;              // [-12.0 ~ 12.0]
	float EQUALIZER_1KHZ;               // [-12.0 ~ 12.0]
	float EQUALIZER_2KHZ;               // [-12.0 ~ 12.0]
	float EQUALIZER_4KHZ;               // [-12.0 ~ 12.0]
	float EQUALIZER_8KHZ;               // [-12.0 ~ 12.0]
	float EQUALIZER_16KHZ;              // [-12.0 ~ 12.0]
	float EQUALIZER_MASTER_GAIN;        // [-12.0 ~ 12.0]
}ITMG_VOICE_TYPE_EQUALIZER;

typedef struct _tag_ITMG_VOICE_TYPE_REVERB
{
	float HARMONIC_GAIN;					//[0,1]
	float HARMONIC_START_FREQUENCY;			//[0,1]
	float HARMONIC_BASS_CONTROL;			//[0,1]
	float REVERB_SIZE;						//[0,1]
	float REVERB_DEPTH;						//[0,1]
	float REVERB_GAIN;						//[0,1]
	float REVERB_ECHO_DEPTH;				//[0,1]
}ITMG_VOICE_TYPE_REVERB;

typedef enum
{
	AUDIO_ROUTE_TYPE_OTHERS = -1,
	AUDIO_ROUTE_TYPE_BUILDINRECIEVER = 0,
	AUDIO_ROUTE_TYPE_SPEAKER = 1,
	AUDIO_ROUTE_TYPE_HEADPHONE = 2,
	AUDIO_ROUTE_TYPE_BLUETOOTH = 3,
} ITMG_AUDIO_ROUTE_TYPE;

typedef struct _tag_TMGAudioDeviceInfo {
    const char* pDeviceID;
    const char* pDeviceName;
} TMGAudioDeviceInfo;

typedef struct _tag_TMGFaceTrackerParam {
    int  minFaceSize;
    int  maxFaceSize;
    int  biggerFaceMode;
    bool nonSquareRect;
    float  threshold;
    int  detInterval;
} TMGFaceTrackerParam;

typedef enum {
    ITMG_IMG_FORMAT_ARGB8888 = 0,     /* packed ARGB, 32 bits ARGBARGB... */
    ITMG_IMG_FORMAT_BGRA8888 = 1,     /* packed BGRA, 32 bits BGRABGRA... */
    ITMG_IMG_FORMAT_ABGR8888 = 2,     /* packed ABGR, 32 bits ABGRABGR... */
    ITMG_IMG_FORMAT_RGBA8888 = 3,     /* packed RGBA, 32 bits RGBARGBA... */
    ITMG_IMG_FORMAT_RGB888 = 4,      /* packed RGB, 24 bits RGBRGB... */
    ITMG_IMG_FORMAT_BGR888 = 5,      /* packed BGR, 24 bits BGRBGR... */
    ITMG_IMG_FORMAT_I420 = 23,       /* planar YUV 4:2:0, 12 bits, YYYYYYYYUUVV... */
    ITMG_IMG_FORMAT_YV12 = 24,         /* planar YUV 4:2:0, 12 bits, YYYYYYYYVVUU... */
    ITMG_IMG_FORMAT_NV12  = 25,      /* interleaved chroma YUV 4:2:0, 12 bits, YYYYYYYY... UVUV... */
    ITMG_IMG_FORMAT_NV21 = 26,       /* interleaved chroma YUV 4:2:0, 12 bits, YYYYYYYY... VUVU... */
} ITMG_IMG_FORMAT;

typedef enum {
    ITMG_IMG_ORIENTATION_0 = 0,    //!<  input image without rotation
    ITMG_IMG_ORIENTATION_90 = 1,    //!<  input image rotated by 90 in counter clockwise direction(flip left)
    ITMG_IMG_ORIENTATION_180 = 2,    //!<  input image rotated by 180 in counter clockwise direction(flip down)
    ITMG_IMG_ORIENTATION_270 = 3,    //!<  input image rotated by 270 in counter clockwise direction(flip right)
} ITMG_IMG_ORIENTATION;

typedef struct _tag_TMGFaceTrackerFaceInfo {
    float blendShapeWeight[51];
    float pitch;
    float yaw;
    float roll;
} TMGFaceTrackerFaceInfo;

typedef struct _tag_TMGPoseTrackerPoseInfo {
    bool hasBody;
    float lm[24][2];
    float bbox[4];
//    float rotmat[24][3][3];
    float euler[24][3];
} TMGPoseTrackerPoseInfo;

typedef struct _tag_GMECustomStreamFrame {
    // NOCA:runtime/int
    unsigned long long uin;
    unsigned char* data;
    unsigned int length;
    // NOCA:runtime/int
    unsigned long long timestamp;
} GMECustomStreamFrame;

typedef void (QAVSDK_CALL*PFCustomStreamDataCallback)(GMECustomStreamFrame* frame, void* user_data);

static const char* GMESDK_VERSION_2_9_15_6fa587cb __UNUSED = "2_9_15_6fa587cb";
