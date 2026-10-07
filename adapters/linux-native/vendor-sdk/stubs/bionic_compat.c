/**
 * Bionic compatibility stubs for running Android .so files on glibc Linux.
 *
 * Android's bionic libc has several symbols that don't exist in glibc.
 * This file provides stub implementations so the Android GME SDK can load.
 *
 * Build: gcc -shared -fPIC -o bionic_compat.so bionic_compat.c -lpthread
 */

#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <errno.h>
#include <ctype.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/select.h>
#include <sys/syscall.h>

/* ===== _ctype_ : bionic's character classification table =====
 * Bionic uses _ctype_ as a 256-byte lookup table for character properties.
 * glibc uses __ctype_b_loc() instead. We provide a compatible table.
 *
 * Bionic ctype flags (from bionic/libc/include/ctype.h):
 *   _U = 0x01 (upper), _L = 0x02 (lower), _D = 0x04 (digit)
 *   _S = 0x08 (space), _P = 0x10 (punct), _C = 0x20 (ctrl)
 *   _X = 0x40 (hex),   _B = 0x80 (blank)
 */
#define _U  0x01
#define _L  0x02
#define _D  0x04
#define _S  0x08
#define _P  0x10
#define _C  0x20
#define _X  0x40
#define _B  0x80

__attribute__((visibility("default")))
const char _ctype_[1 + 256] = {
    0,                                          /* EOF (-1) */
    _C,_C,_C,_C,_C,_C,_C,_C,                   /* 0x00-0x07 */
    _C,_C|_S|_B,_C|_S,_C|_S,_C|_S,_C|_S,_C,_C, /* 0x08-0x0F (0x09=TAB,0x0A=LF,...) */
    _C,_C,_C,_C,_C,_C,_C,_C,                   /* 0x10-0x17 */
    _C,_C,_C,_C,_C,_C,_C,_C,                   /* 0x18-0x1F */
    _S|_B,_P,_P,_P,_P,_P,_P,_P,                /* 0x20-0x27 (space,!,",...) */
    _P,_P,_P,_P,_P,_P,_P,_P,                   /* 0x28-0x2F */
    _D|_X,_D|_X,_D|_X,_D|_X,_D|_X,_D|_X,_D|_X,_D|_X, /* 0x30-0x37 (0-7) */
    _D|_X,_D|_X,_P,_P,_P,_P,_P,_P,            /* 0x38-0x3F (8,9,:,...) */
    _P,_U|_X,_U|_X,_U|_X,_U|_X,_U|_X,_U|_X,_U, /* 0x40-0x47 (@,A-F,G) */
    _U,_U,_U,_U,_U,_U,_U,_U,                   /* 0x48-0x4F */
    _U,_U,_U,_U,_U,_U,_U,_U,                   /* 0x50-0x57 */
    _U,_U,_U,_P,_P,_P,_P,_P,                   /* 0x58-0x5F */
    _P,_L|_X,_L|_X,_L|_X,_L|_X,_L|_X,_L|_X,_L, /* 0x60-0x67 (`,a-f,g) */
    _L,_L,_L,_L,_L,_L,_L,_L,                   /* 0x68-0x6F */
    _L,_L,_L,_L,_L,_L,_L,_L,                   /* 0x70-0x77 */
    _L,_L,_L,_P,_P,_P,_P,_C,                   /* 0x78-0x7F */
    /* 0x80-0xFF: all zero (high ASCII / non-ASCII) */
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
};

#undef _U
#undef _L
#undef _D
#undef _S
#undef _P
#undef _C
#undef _X
#undef _B

/* ===== __sF : bionic's stdio FILE array =====
 * Bionic exposes stdin/stdout/stderr as __sF[0], __sF[1], __sF[2].
 * We redirect to glibc's stdin/stdout/stderr.
 * Using FILE* pointers (each FILE is large, but the SDK only accesses via pointer).
 */
__attribute__((visibility("default")))
__attribute__((constructor))
void __init_sF(void);

/* Bionic __sF is an array of FILE structs. The SDK only uses __sF[0..2].
 * We allocate a buffer large enough and copy glibc's FILE structs at init time.
 * Most code just takes &__sF[N] and passes to fprintf etc. */
__attribute__((visibility("default")))
FILE __sF[3];

void __init_sF(void) {
    if (stdin)  memcpy(&__sF[0], stdin, sizeof(FILE));
    if (stdout) memcpy(&__sF[1], stdout, sizeof(FILE));
    if (stderr) memcpy(&__sF[2], stderr, sizeof(FILE));
}

/* ===== __errno : bionic's errno accessor =====
 * Bionic: int* __errno(void)  -- returns pointer to thread-local errno
 * glibc:  int* __errno_location(void)
 */
__attribute__((visibility("default")))
int* __errno(void) {
    return &errno;  /* glibc's errno is already thread-local */
}

/* ===== android_set_abort_message =====
 * Android uses this to set a message before aborting. Just log and ignore.
 */
__attribute__((visibility("default")))
void android_set_abort_message(const char* msg) {
    if (msg) fprintf(stderr, "[bionic_compat] abort message: %s\n", msg);
}

/* ===== gettid =====
 * Available in glibc >= 2.30, but we provide it for older systems too.
 */
__attribute__((visibility("default"), weak))
pid_t gettid(void) {
    return (pid_t)syscall(SYS_gettid);
}

/* ===== Fortified string functions (bionic-specific variants) ===== */

__attribute__((visibility("default")))
char* __strncpy_chk2(char* dst, const char* src, size_t n, size_t dst_len, size_t src_len) {
    (void)dst_len;
    (void)src_len;
    return strncpy(dst, src, n);
}

__attribute__((visibility("default")))
int __FD_ISSET_chk(int fd, fd_set* set) {
    return FD_ISSET(fd, set);
}

__attribute__((visibility("default")))
void __FD_SET_chk(int fd, fd_set* set) {
    FD_SET(fd, set);
}

__attribute__((visibility("default")))
int __open_2(const char* pathname, int flags) {
    return open(pathname, flags);
}

__attribute__((visibility("default")))
ssize_t __read_chk(int fd, void* buf, size_t count, size_t buf_size) {
    (void)buf_size;
    return read(fd, buf, count);
}

/* ===== __strchr_chk / __strrchr_chk (bionic fortify) ===== */
__attribute__((visibility("default")))
char* __strchr_chk(const char* s, int c, size_t s_len) {
    (void)s_len;
    return strchr(s, c);
}

__attribute__((visibility("default")))
char* __strrchr_chk(const char* s, int c, size_t s_len) {
    (void)s_len;
    return strrchr(s, c);
}

/* ===== __strlen_chk (bionic fortify) ===== */
__attribute__((visibility("default")))
size_t __strlen_chk(const char* s, size_t s_len) {
    (void)s_len;
    return strlen(s);
}

/* ===== __strncat_chk (bionic fortify) ===== */
__attribute__((visibility("default")))
char* __strncat_chk(char* dst, const char* src, size_t n, size_t dst_buf_size) {
    (void)dst_buf_size;
    return strncat(dst, src, n);
}

/* ===== __memcpy_chk / __memmove_chk / __memset_chk (bionic fortify) ===== */
__attribute__((visibility("default")))
void* __memcpy_chk(void* dst, const void* src, size_t n, size_t dst_len) {
    (void)dst_len;
    return memcpy(dst, src, n);
}

__attribute__((visibility("default")))
void* __memmove_chk(void* dst, const void* src, size_t n, size_t dst_len) {
    (void)dst_len;
    return memmove(dst, src, n);
}

__attribute__((visibility("default")))
void* __memset_chk(void* dst, int c, size_t n, size_t dst_len) {
    (void)dst_len;
    return memset(dst, c, n);
}

/* ===== Android system property stubs ===== */
/* Android SDK may call __system_property_get to read device info.
 * We return empty strings so the SDK doesn't crash. */
struct prop_info;

__attribute__((visibility("default")))
int __system_property_get(const char* name, char* value) {
    if (value) value[0] = '\0';
    return 0;
}

__attribute__((visibility("default")))
const struct prop_info* __system_property_find(const char* name) {
    (void)name;
    return NULL;
}

__attribute__((visibility("default")))
int __system_property_set(const char* key, const char* value) {
    (void)key; (void)value;
    return 0;
}

__attribute__((visibility("default")))
void __system_property_read_callback(
    const struct prop_info* pi,
    void (*callback)(void* cookie, const char* name, const char* value, unsigned serial),
    void* cookie)
{
    (void)pi;
    if (callback) callback(cookie, "", "", 0);
}

/* ===== __vsnprintf_chk / __vsprintf_chk (bionic fortify) ===== */
__attribute__((visibility("default")))
int __vsnprintf_chk(char* dst, size_t size, int flags, size_t dst_len, const char* fmt, va_list ap) {
    (void)flags;
    (void)dst_len;
    return vsnprintf(dst, size, fmt, ap);
}

__attribute__((visibility("default")))
int __vsprintf_chk(char* dst, int flags, size_t dst_len, const char* fmt, va_list ap) {
    (void)flags;
    (void)dst_len;
    return vsprintf(dst, fmt, ap);
}
