#pragma once

#include <ctype.h>
#include <stdlib.h>
#include <string.h>
#include <string>

// The native adapters are deliberately authenticated even though bot-server
// normally reaches them over loopback. This also protects a developer machine
// where an old firewall rule or a LAN binding would otherwise expose /join and
// /play. GME_ADAPTER_AUTH_REQUIRED=false is an explicit escape hatch for
// standalone manual debugging; bot-server always sets it to true.
inline bool gmeAdapterAuthRequired() {
    const char* value = getenv("GME_ADAPTER_AUTH_REQUIRED");
    return !(value && (strcmp(value, "false") == 0 || strcmp(value, "0") == 0));
}

inline std::string gmeAdapterExpectedToken() {
    const char* value = getenv("GME_ADAPTER_TOKEN");
    return value ? std::string(value) : std::string();
}

inline bool gmeHeaderNameEquals(const char* start, size_t length, const char* expected) {
    size_t expectedLength = strlen(expected);
    if (length != expectedLength) return false;
    for (size_t i = 0; i < length; i++) {
        if (tolower((unsigned char)start[i]) != tolower((unsigned char)expected[i])) return false;
    }
    return true;
}

inline std::string gmeAdapterRequestToken(const char* request) {
    if (!request) return std::string();
    const char* line = request;
    while (*line) {
        const char* end = strstr(line, "\r\n");
        if (!end) end = line + strlen(line);
        const char* colon = (const char*)memchr(line, ':', (size_t)(end - line));
        if (colon && gmeHeaderNameEquals(line, (size_t)(colon - line), "x-gme-adapter-token")) {
            const char* value = colon + 1;
            while (value < end && (*value == ' ' || *value == '\t')) value++;
            const char* valueEnd = end;
            while (valueEnd > value && (valueEnd[-1] == ' ' || valueEnd[-1] == '\t')) valueEnd--;
            return std::string(value, valueEnd - value);
        }
        if (!*end) break;
        line = end + 2;
    }
    return std::string();
}

inline bool gmeAdapterTokensMatch(const std::string& expected, const std::string& candidate) {
    if (expected.empty() || expected.size() != candidate.size()) return false;
    unsigned char different = 0;
    for (size_t i = 0; i < expected.size(); i++) {
        different |= (unsigned char)(expected[i] ^ candidate[i]);
    }
    return different == 0;
}

inline bool gmeAdapterRequestAuthorized(const char* request) {
    if (!gmeAdapterAuthRequired()) return true;
    const std::string expected = gmeAdapterExpectedToken();
    if (expected.empty()) return false;
    return gmeAdapterTokensMatch(expected, gmeAdapterRequestToken(request));
}
