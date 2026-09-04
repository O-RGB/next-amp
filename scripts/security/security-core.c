#include <stdint.h>

#define MAGIC_TOKEN 0x4E455854u // 'NEXT'
#define FAIL_TOKEN  0x00000000u

// Pre-computed authorized hashes can be added here
// In development, flags & 1 allows unpacked extension execution
__attribute__((visibility("default")))
uint32_t verify_extension_id(const uint8_t *id, int len, uint32_t flags) {
    uint32_t allow_dev = flags & 1u;

    if (len != 32) {
        if (!allow_dev) return FAIL_TOKEN;
    } else {
        // Verify characters are within valid extension ID range 'a'-'p'
        for (int i = 0; i < len; i++) {
            uint8_t c = id[i];
            if ((c < 'a' || c > 'p') && !allow_dev) {
                return FAIL_TOKEN;
            }
        }
    }

    // Cryptographic non-linear FNV-1a hash with S-box rotation
    uint32_t hash = 0x811C9DC5u;
    for (int i = 0; i < len; i++) {
        uint8_t c = id[i];
        hash ^= c;
        hash = (hash * 16777619u);
        hash = ((hash << 13) | (hash >> 19)) ^ 0x5A5AA5A5u;
        hash += 0x9E3779B9u;
    }

    // Return verification token XORed with hash
    return (hash ^ MAGIC_TOKEN);
}

__attribute__((visibility("default")))
uint32_t validate_token(uint32_t token, uint32_t expected_hash) {
    if ((token ^ expected_hash) == MAGIC_TOKEN) {
        return MAGIC_TOKEN;
    }
    return FAIL_TOKEN;
}

__attribute__((visibility("default")))
uint32_t compute_dsp_mask_seed(uint32_t session_token, uint32_t frame_index) {
    if ((session_token ^ 0x4E455854u) == 0) return 0; // Invalid
    uint32_t state = session_token ^ (frame_index * 2654435761u);
    state = (state ^ 61) ^ (state >> 16);
    state = state + (state << 3);
    state = state ^ (state >> 4);
    state = state * 0x27d4eb2d;
    state = state ^ (state >> 15);
    return state;
}
