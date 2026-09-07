/* Deterministic raw-mode terminal application, not a provider integration. */
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <termios.h>
#include <stdint.h>
#include <inttypes.h>
#include <time.h>
#include <unistd.h>

static int command(const char *expected) {
    char line[32];
    return fgets(line, sizeof(line), stdin) && !strcmp(line, expected);
}

#ifdef BURST
static uint64_t monotonic_ns(void) {
    struct timespec now;
    if (clock_gettime(CLOCK_MONOTONIC, &now)) return 0;
    return (uint64_t)now.tv_sec * 1000000000 + (uint64_t)now.tv_nsec;
}

static int burst(void) {
    fputs("BURST_READY\r\n", stdout);
    if (!command("run\n")) return 71;
    uint64_t started = monotonic_ns(), max_write = 0;
    for (unsigned i = 0; i < 4096; i++) {
        char line[96];
        int length = snprintf(line, sizeof(line), "ROW %u xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\r\n", i);
        if (length <= 0 || (size_t)length >= sizeof(line)) return 72;
        size_t position = 0;
        uint64_t before = monotonic_ns();
        while (position < (size_t)length) {
            ssize_t written = write(1, line + position, (size_t)length - position);
            if (written < 0 && errno == EINTR) continue;
            if (written <= 0) return 72;
            position += (size_t)written;
        }
        uint64_t elapsed = monotonic_ns() - before;
        if (elapsed > max_write) max_write = elapsed;
    }
    printf("BURST_DONE 4096 MAX_WRITE_NS %" PRIu64 " TOTAL_NS %" PRIu64 "\r\n", max_write, monotonic_ns() - started);
    return command("finish\n") ? 23 : 73;
}
#endif

int main(void) {
    struct termios settings;
    if (tcgetattr(0, &settings)) return 70;
    cfmakeraw(&settings);
    if (tcsetattr(0, TCSANOW, &settings)) return 70;
    setbuf(stdout, NULL);
    setbuf(stdin, NULL);
#ifdef BURST
    return burst();
#endif
    fputs("PRIMARY\033[?1049h\033[HALT\033[31", stdout);
    if (!command("continue\n")) return 71;
    fputs("mRED\033[6n", stdout);
    unsigned char reply[32];
    size_t size = 0;
    while (size < sizeof(reply)) {
        ssize_t count = read(0, reply + size, 1);
        if (count < 0 && errno == EINTR) continue;
        if (count != 1) return 72;
        if (reply[size++] == 'R') break;
    }
    fputs("\r\nQUERY=", stdout);
    for (size_t i = 0; i < size; i++) printf("%02x", reply[i]);
    fputs("\r\n", stdout);
    if (!command("finish\n")) return 73;
    fputs("\033[?1049lDONE\r\n", stdout);
    return 23;
}
