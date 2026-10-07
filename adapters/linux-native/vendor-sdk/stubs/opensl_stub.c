/**
 * OpenSL ES stub for running Android GME SDK on Linux.
 *
 * The Android GME SDK uses OpenSL ES for audio output. On Linux there's no
 * OpenSL ES, so we provide a stub libOpenSLES.so that returns "not supported"
 * for all operations. The SDK should fall back gracefully (it only needs
 * network streaming, not local audio playback).
 *
 * Build: gcc -shared -fPIC -o libOpenSLES.so opensl_stub.c
 */

#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

/* OpenSL ES result codes */
typedef uint32_t SLresult;
#define SL_RESULT_SUCCESS           ((SLresult) 0x00000000)
#define SL_RESULT_FEATURE_UNSUPPORTED ((SLresult) 0x0000000C)
#define SL_RESULT_INTERNAL_ERROR    ((SLresult) 0x00000006)

typedef uint32_t SLuint32;
typedef int32_t  SLint32;
typedef uint16_t SLuint16;
typedef int16_t  SLint16;
typedef uint8_t  SLuint8;
typedef int8_t   SLint8;
typedef char     SLchar;
typedef float    SLmillibel;
typedef uint32_t SLmillisecond;
typedef uint32_t SLboolean;

#define SL_BOOLEAN_FALSE ((SLboolean) 0x00000000)
#define SL_BOOLEAN_TRUE  ((SLboolean) 0x00000001)

/* Opaque types */
typedef const void* SLInterfaceID;
typedef void* SLObjectItf;
typedef void* SLEngineItf;

/* OpenSL ES object interface - minimal vtable that returns errors */
typedef struct {
    SLresult (*Realize)(void* self, SLboolean async);
    SLresult (*Resume)(void* self, SLboolean async);
    SLresult (*GetState)(void* self, SLuint32* pState);
    SLresult (*GetInterface)(void* self, SLInterfaceID iid, void* pInterface);
    void     (*Destroy)(void* self);
    /* ... more methods, but SDK typically only uses these */
} SLObjectItf_vtable;

static SLresult stub_Realize(void* self, SLboolean async) {
    (void)self; (void)async;
    fprintf(stderr, "[OpenSL stub] Realize called - returning unsupported\n");
    return SL_RESULT_FEATURE_UNSUPPORTED;
}

static SLresult stub_Resume(void* self, SLboolean async) {
    (void)self; (void)async;
    return SL_RESULT_FEATURE_UNSUPPORTED;
}

static SLresult stub_GetState(void* self, SLuint32* pState) {
    (void)self;
    if (pState) *pState = 0;
    return SL_RESULT_FEATURE_UNSUPPORTED;
}

static SLresult stub_GetInterface(void* self, SLInterfaceID iid, void* pInterface) {
    (void)self; (void)iid; (void)pInterface;
    fprintf(stderr, "[OpenSL stub] GetInterface called - returning unsupported\n");
    return SL_RESULT_FEATURE_UNSUPPORTED;
}

static void stub_Destroy(void* self) {
    (void)self;
}

static SLObjectItf_vtable g_stub_vtable = {
    stub_Realize,
    stub_Resume,
    stub_GetState,
    stub_GetInterface,
    stub_Destroy
};

static SLObjectItf_vtable* g_stub_object = &g_stub_vtable;

/**
 * slCreateEngine — the main entry point for OpenSL ES.
 * Android GME SDK calls this to create an audio engine.
 * We return a stub object that fails gracefully on all operations.
 */
__attribute__((visibility("default")))
SLresult slCreateEngine(
    void** pEngine,
    SLuint32 numOptions,
    const void* pEngineOptions,
    SLuint32 numInterfaces,
    const SLInterfaceID* pInterfaceIds,
    const SLboolean* pInterfaceRequired)
{
    (void)numOptions; (void)pEngineOptions;
    (void)numInterfaces; (void)pInterfaceIds; (void)pInterfaceRequired;
    fprintf(stderr, "[OpenSL stub] slCreateEngine called - returning stub object\n");

    if (pEngine) {
        *pEngine = &g_stub_object;
    }
    return SL_RESULT_SUCCESS;
}

/* Interface ID exports that the SDK may reference */
static const struct { uint32_t a; } _SL_IID_ENGINE_data = {0};
static const struct { uint32_t a; } _SL_IID_PLAY_data = {0};
static const struct { uint32_t a; } _SL_IID_BUFFERQUEUE_data = {0};
static const struct { uint32_t a; } _SL_IID_VOLUME_data = {0};
static const struct { uint32_t a; } _SL_IID_OUTPUTMIX_data = {0};
static const struct { uint32_t a; } _SL_IID_ANDROIDSIMPLEBUFFERQUEUE_data = {0};

__attribute__((visibility("default"))) const void* const SL_IID_ENGINE = &_SL_IID_ENGINE_data;
__attribute__((visibility("default"))) const void* const SL_IID_PLAY = &_SL_IID_PLAY_data;
__attribute__((visibility("default"))) const void* const SL_IID_BUFFERQUEUE = &_SL_IID_BUFFERQUEUE_data;
__attribute__((visibility("default"))) const void* const SL_IID_VOLUME = &_SL_IID_VOLUME_data;
__attribute__((visibility("default"))) const void* const SL_IID_OUTPUTMIX = &_SL_IID_OUTPUTMIX_data;
__attribute__((visibility("default"))) const void* const SL_IID_ANDROIDSIMPLEBUFFERQUEUE = &_SL_IID_ANDROIDSIMPLEBUFFERQUEUE_data;
