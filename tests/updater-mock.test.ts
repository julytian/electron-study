import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  createUpdaterMachine,
  parseGitHubRepository,
  readPackageRepository
} from '../src/main/services/updater';

describe('updater machine', () => {
  it('walks mock states', () => {
    const machine = createUpdaterMachine({ packaged: false });
    expect(machine.status).toBe('idle');
    machine.mock('checking');
    machine.mock('available');
    machine.mock('downloading');
    machine.mock('downloaded');
    expect(machine.status).toBe('downloaded');
  });

  it('allows mock error jumps for the lab', () => {
    const machine = createUpdaterMachine({ packaged: false });
    machine.mock('error');
    expect(machine.status).toBe('error');
  });

  it('checks and downloads without network when unpackaged', () => {
    const machine = createUpdaterMachine({ packaged: false });
    const checked = machine.check();
    expect(checked.status).toBe('available');
    expect(checked.version).toBeTruthy();
    expect(machine.status).toBe('available');

    machine.download();
    expect(machine.status).toBe('downloaded');
  });

  it('install is noop when unpackaged and quit when packaged+downloaded', () => {
    const dev = createUpdaterMachine({ packaged: false });
    dev.mock('downloaded');
    expect(dev.install()).toBe('noop');

    const packaged = createUpdaterMachine({ packaged: true });
    packaged.mock('downloaded');
    expect(packaged.install()).toBe('quit');
    packaged.mock('available');
    expect(packaged.install()).toBe('noop');
  });

  it('notifies subscribers on status changes', () => {
    const machine = createUpdaterMachine({ packaged: false });
    const seen: string[] = [];
    machine.onStatus((event) => {
      seen.push(event.status);
    });
    machine.mock('checking');
    machine.check();
    expect(seen[0]).toBe('checking');
    expect(seen.at(-1)).toBe('available');
  });
});

describe('parseGitHubRepository', () => {
  it('returns null when repository is missing', () => {
    expect(parseGitHubRepository(undefined)).toBeNull();
    expect(parseGitHubRepository({})).toBeNull();
  });

  it('parses string and object repository fields', () => {
    expect(parseGitHubRepository('https://github.com/acme/electron-study.git')).toEqual({
      owner: 'acme',
      repo: 'electron-study'
    });
    expect(parseGitHubRepository({ url: 'git@github.com:acme/electron-study.git' })).toEqual({
      owner: 'acme',
      repo: 'electron-study'
    });
    expect(parseGitHubRepository('acme/electron-study')).toEqual({
      owner: 'acme',
      repo: 'electron-study'
    });
  });

  it('keeps mock when the app package.json has no repository', () => {
    expect(readPackageRepository(resolve(__dirname, '..'))).toBeNull();
  });
});
