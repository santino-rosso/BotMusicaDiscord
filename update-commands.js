// Archivo para actualizar los comandos automáticamente en caso de cambios
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// Función para verificar y actualizar comandos si es necesario
async function checkAndUpdateCommands() {
  try {
    console.log('🔍 Verificando cambios en los comandos...');

    // CLIENT_ID es obligatorio: es el Application ID de LA APLICACIÓN DEL USUARIO.
    // Sin él el bot aparece online (TOKEN válido) pero sus slash commands
    // no existen en ningún lado. Falla explícito en vez de registrar en otra app.
    const clientId = (process.env.CLIENT_ID || '').trim();
    if (!clientId) {
      console.error("❌ Falta CLIENT_ID en el .env. Es tu Application ID (Developer Portal > General Information). Sin él los slash commands no se pueden registrar.");
      return false;
    }
    // GUILD_ID opcional: registro por servidor = propagación inmediata.
    // Sin GUILD_ID se usan comandos globales (tardan hasta 1 hora en aparecer).
    const guildId = (process.env.GUILD_ID || '').trim();
    
    // Cargar el archivo de estado anterior si existe
    let previousState = {};
    const stateFilePath = path.join(__dirname, 'commands-state.json');
    if (fs.existsSync(stateFilePath)) {
      try {
        previousState = JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
      } catch {
        previousState = {};
      }
    }
    
    // Cargar comandos actuales
    const commands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands'));
    
    for (const file of commandFiles) {
      if (!file.endsWith('.js')) continue;
      
      try {
        // Eliminar caché para recargar el comando
        delete require.cache[require.resolve(`./commands/${file}`)];
        const command = require(`./commands/${file}`);
        if (command.data) {
          commands.push(command.data.toJSON());
        } else {
          console.warn(`⚠️ El comando ${file} no tiene la propiedad 'data'.`);
        }
      } catch (error) {
        console.error(`❌ Error al cargar el comando ${file}:`, error);
      }
    }
    
    // Generar hash de los comandos actuales + destino del registro.
    // Incluir clientId/guildId evita el "quedado trabado": si el usuario corrige
    // el CLIENT_ID, el hash cambia y fuerza un re-deploy a la app correcta
    // aunque la lista de comandos sea idéntica.
    const currentCommandsJSON = JSON.stringify({ commands, clientId, guildId });
    const currentCommandsHash = require('crypto')
      .createHash('md5')
      .update(currentCommandsJSON)
      .digest('hex');
    
    // Guardar el estado SOLO si no hay cambios (timestamp se actualiza igual)
    // o DESPUÉS de un deploy exitoso (ver abajo). Si el deploy falla, el hash
    // viejo queda en el archivo y el reintento ocurre en el próximo arranque.
    const saveState = () => fs.writeFileSync(stateFilePath, JSON.stringify({ 
      hash: currentCommandsHash,
      clientId,
      guildId: guildId || undefined,
      timestamp: new Date().toISOString(),
      count: commands.length
    }));
    
    // Si no hay cambios de comandos NI de destino, salir.
    // Un state viejo sin clientId se considera desactualizado y fuerza deploy.
    if (previousState.hash === currentCommandsHash && previousState.clientId === clientId && (previousState.guildId || '') === guildId) {
      saveState();
      console.log('✅ No hay cambios en los comandos. No es necesario actualizar.');
      return false;
    }
    
    // Actualizar los comandos en Discord
    if ((previousState.clientId || '') !== '' && previousState.clientId !== clientId) {
      console.log(`🔄 El CLIENT_ID cambió (${previousState.clientId} → ${clientId}). Re-registrando comandos en la aplicación correcta...`);
    } else {
      console.log(`🔄 Se detectaron cambios en los comandos. Actualizando ${commands.length} comandos...`);
    }
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
    } else {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
    }
    
    // Guardar el nuevo estado SOLO después del deploy exitoso
    saveState();
    if (guildId) {
      console.log('✅ Comandos actualizados exitosamente (servidor: aparecen al instante).');
    } else {
      console.log('✅ Comandos actualizados exitosamente. Los comandos globales tardan hasta 1 hora en aparecer en Discord.');
    }
    return true;
  } catch (error) {
    console.error('❌ Error al actualizar los comandos:', error);
    return false;
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  checkAndUpdateCommands();
} else {
  // Exportar para uso en otros archivos
  module.exports = checkAndUpdateCommands;
}
