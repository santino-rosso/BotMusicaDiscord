'use strict';

// Tests de update-commands.js. Estrategia:
// - El módulo usa path.join(__dirname, ...) apuntando a la raíz real del repo,
//   así que se stubbean fs.existsSync/readFileSync/writeFileSync para redirigir
//   el state file a un Map en memoria (nunca se toca commands-state.json real).
// - require('discord.js') se intercepta con un Proxy que solo reemplaza REST
//   (para capturar el PUT) y deja pasar el resto real (SlashCommandBuilder,
//   Routes) a los comandos.
//
// NOT TESTABLE: la rama require.main === module (deploy manual vía
// `node update-commands.js`) y el PUT real a la API de Discord: requerirían
// red real o un spawn de proceso, fuera de alcance de este archivo.

process.env.TOKEN = 'test-token';
process.env.CLIENT_ID = '123456789';

const { test, describe, mock, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('fs');
const path = require('path');
const Module = require('module');

const realLoad = Module._load;
const realReadFileSync = fs.readFileSync;
const realExistsSync = fs.existsSync;
const realWriteFileSync = fs.writeFileSync;

const statePath = path.join(__dirname, '..', 'commands-state.json');
const stateStore = new Map();
const eventLog = [];

const rest = { instances: [], fail: false };

class FakeREST {
  constructor(options) {
    this.options = options;
    this.calls = [];
    rest.instances.push(this);
  }

  setToken(token) {
    this.token = token;
    return this;
  }

  async put(url, options) {
    eventLog.push('put');
    this.calls.push({ url, body: options.body });
    if (rest.fail) throw new Error('deploy falla (simulado)');
    return {};
  }
}

mock.method(Module, '_load', function (request, parent, isMain) {
  if (request === 'discord.js') {
    const realDiscord = realLoad.call(this, request, parent, isMain);
    return new Proxy(realDiscord, {
      get(target, prop) {
        if (prop === 'REST') return FakeREST;
        return target[prop];
      },
    });
  }
  return realLoad.call(this, request, parent, isMain);
});

mock.method(fs, 'existsSync', (p) => {
  if (String(p).endsWith('commands-state.json')) return stateStore.has(p);
  return realExistsSync.call(fs, p);
});
mock.method(fs, 'readFileSync', (p, ...args) => {
  if (String(p).endsWith('commands-state.json')) return stateStore.get(p);
  return realReadFileSync.call(fs, p, ...args);
});
mock.method(fs, 'writeFileSync', (p, content, ...args) => {
  if (String(p).endsWith('commands-state.json')) {
    eventLog.push('write');
    stateStore.set(p, String(content));
    return;
  }
  return realWriteFileSync.call(fs, p, content, ...args);
});

mock.method(console, 'log', () => {});
mock.method(console, 'error', () => {});
mock.method(console, 'warn', () => {});

const checkAndUpdateCommands = require('../update-commands');

let firstHash = null;

beforeEach(() => {
  stateStore.clear();
  eventLog.length = 0;
  rest.instances.length = 0;
  rest.fail = false;
  process.env.CLIENT_ID = '123456789';
  delete process.env.GUILD_ID;
});

describe('checkAndUpdateCommands', () => {
  test('primer arranque sin state file: hace PUT y recién después guarda el estado', async () => {
    const result = await checkAndUpdateCommands();

    assert.equal(result, true);
    assert.equal(rest.instances.length, 1);
    const putCall = rest.instances[0].calls[0];
    assert.ok(putCall, 'debería haber llamado a REST.put');
    assert.match(putCall.url, /\/applications\/123456789\/commands$/);
    assert.equal(putCall.body.length, 9);

    // Orden crítico: deploy primero, guardar estado después
    assert.deepEqual(eventLog, ['put', 'write']);

    const written = JSON.parse(stateStore.get(statePath));
    assert.equal(written.count, 9);
    assert.ok(written.hash.length > 0);
    assert.ok(written.timestamp);
    assert.equal(written.clientId, '123456789');
    firstHash = written.hash;
  });

  test('segundo arranque sin cambios: NO hace PUT, solo actualiza timestamp', async () => {
    assert.ok(firstHash, 'el hash capturado del primer arranque');
    stateStore.set(
      statePath,
      JSON.stringify({ hash: firstHash, clientId: '123456789', timestamp: 'anterior', count: 9 })
    );

    const result = await checkAndUpdateCommands();

    assert.equal(result, false);
    assert.equal(rest.instances.length, 0, 'no debería hacer deploy');
    assert.deepEqual(eventLog, ['write']);
  });

  test('deploy que falla: no guarda el hash nuevo, queda el viejo', async () => {
    stateStore.set(
      statePath,
      JSON.stringify({ hash: 'old-hash-000', clientId: '123456789', timestamp: 'anterior', count: 9 })
    );
    rest.fail = true;

    const result = await checkAndUpdateCommands();

    assert.equal(result, false);
    assert.equal(rest.instances[0].calls.length, 1, 'debería intentar el deploy');
    assert.ok(!eventLog.includes('write'), 'no debería guardar estado tras un deploy fallido');
    assert.equal(JSON.parse(stateStore.get(statePath)).hash, 'old-hash-000');
  });

  test('primer arranque con deploy fallido: no se crea el archivo de estado', async () => {
    rest.fail = true;

    const result = await checkAndUpdateCommands();

    assert.equal(result, false);
    assert.equal(stateStore.size, 0, 'no debería existir state file');
  });

  test('tras un deploy fallido, el siguiente arranque reintenta y guarda el estado', async () => {
    stateStore.set(
      statePath,
      JSON.stringify({ hash: 'old-hash-000', clientId: '123456789', timestamp: 'anterior', count: 9 })
    );
    rest.fail = true;
    assert.equal(await checkAndUpdateCommands(), false);

    rest.fail = false;
    assert.equal(await checkAndUpdateCommands(), true);
    assert.equal(JSON.parse(stateStore.get(statePath)).hash, firstHash);
  });

  test('sin CLIENT_ID: no hace PUT ni guarda estado (falla explícito)', async () => {
    delete process.env.CLIENT_ID;

    const result = await checkAndUpdateCommands();

    assert.equal(result, false);
    assert.equal(rest.instances.length, 0, 'no debería llamar a la API sin CLIENT_ID');
    assert.equal(stateStore.size, 0, 'no debería guardar estado sin CLIENT_ID');
  });

  test('cambio de CLIENT_ID fuerza re-deploy aunque los comandos sean iguales', async () => {
    assert.ok(firstHash, 'el hash capturado del primer arranque');
    stateStore.set(
      statePath,
      JSON.stringify({ hash: firstHash, clientId: 'app-vieja-999', timestamp: 'anterior', count: 9 })
    );

    const result = await checkAndUpdateCommands();

    assert.equal(result, true, 'debería re-registrar en la app correcta');
    assert.equal(rest.instances.length, 1);
    assert.match(rest.instances[0].calls[0].url, /\/applications\/123456789\/commands$/);
    assert.equal(JSON.parse(stateStore.get(statePath)).clientId, '123456789');
  });

  test('state viejo sin clientId (formato anterior) fuerza deploy de migración', async () => {
    assert.ok(firstHash, 'el hash capturado del primer arranque');
    // El hash viejo era solo de los comandos; el nuevo incluye clientId,
    // así que nunca coinciden, pero además la falta de clientId fuerza deploy.
    stateStore.set(
      statePath,
      JSON.stringify({ hash: 'cualquier-hash-viejo', timestamp: 'anterior', count: 9 })
    );

    const result = await checkAndUpdateCommands();

    assert.equal(result, true, 'debería migrar el state viejo con un deploy');
    assert.equal(rest.instances.length, 1);
  });

  test('con GUILD_ID: registra comandos de servidor (instantáneos)', async () => {
    process.env.GUILD_ID = '987654321';

    const result = await checkAndUpdateCommands();

    assert.equal(result, true);
    assert.equal(rest.instances.length, 1);
    const putCall = rest.instances[0].calls[0];
    assert.match(putCall.url, /\/applications\/123456789\/guilds\/987654321\/commands$/);
    assert.equal(JSON.parse(stateStore.get(statePath)).guildId, '987654321');
  });
});

after(() => {
  mock.restoreAll();
});
