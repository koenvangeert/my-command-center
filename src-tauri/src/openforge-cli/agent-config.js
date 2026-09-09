import { constants, closeSync, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';

// An explicit but unusable agent configuration must never fall back to another installation.
export function readAgentConfig(path) {
  let fd;
  try {
    if (!isAbsolute(path) || typeof process.getuid !== 'function') throw new Error();
    const parent = lstatSync(dirname(path));
    if (!parent.isDirectory() || parent.uid !== process.getuid() || (parent.mode & 0o777) !== 0o700) throw new Error();
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.size > 4096) throw new Error();
    const config = JSON.parse(readFileSync(fd, 'utf8'));
    if (config.version !== 1 || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 || !/^[a-f0-9]{64}$/u.test(config.token)) throw new Error();
    return { port: config.port, token: config.token };
  } catch {
    throw new Error('OpenForge agent configuration unavailable or invalid; request not executed. Restore the private configuration before retrying.');
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
