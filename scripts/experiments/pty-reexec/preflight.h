/* Private experiment preflight. Never lends live descriptors to the probe. */
static bool accepts_checkpoint(const char *target, unsigned format, size_t bytes) {
    char contract[64];
    snprintf(contract, sizeof(contract), "%u:%zu", format, bytes);
    pid_t probe = fork();
    if (probe < 0) return false;
    if (!probe) {
        for (int fd = 0; fd < getdtablesize(); fd++) close(fd);
        int null_fd = open("/dev/null", O_RDWR);
        if (null_fd != 0 || dup2(null_fd, 1) < 0 || dup2(null_fd, 2) < 0) _exit(126);
        execl(target, target, "--check-state", contract, NULL);
        _exit(127);
    }
    int status;
    for (int attempt = 0; attempt < 200; attempt++) {
        pid_t result = waitpid(probe, &status, WNOHANG);
        if (result == probe) return WIFEXITED(status) && WEXITSTATUS(status) == 0;
        if (result < 0 && errno != EINTR) return false;
        usleep(10000);
    }
    /* The unreaped direct child pins this PID. Timeout never signals sessions. */
    kill(probe, SIGKILL);
    while (waitpid(probe, &status, 0) < 0 && errno == EINTR) {}
    return false;
}
