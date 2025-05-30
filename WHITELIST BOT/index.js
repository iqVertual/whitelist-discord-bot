const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });

const prefix = "$";

const OWNER_ID = 'YOUR_USER_ID_HERE'; // <-- Replace with your Discord user ID

const GUILDS_FILE = 'guilds.json';
const EXEMPT_FILE = 'exempt.json';

let guilds = {};
let exemptFromHierarchy = [];

function loadGuilds() {
    try {
        const data = fs.readFileSync(GUILDS_FILE, 'utf8');
        const parsed = JSON.parse(data);
        guilds = {};
        for (const [guildId, obj] of Object.entries(parsed)) {
            guilds[guildId] = {
                whitelist: new Set(obj.whitelist),
                managers: new Set(obj.managers)
            };
        }
    } catch {
        guilds = {};
    }
}

function saveGuilds() {
    const serializable = {};
    for (const [guildId, obj] of Object.entries(guilds)) {
        serializable[guildId] = {
            whitelist: Array.from(obj.whitelist),
            managers: Array.from(obj.managers)
        };
    }
    fs.writeFileSync(GUILDS_FILE, JSON.stringify(serializable, null, 2));
}

function loadExempt() {
    try {
        exemptFromHierarchy = JSON.parse(fs.readFileSync(EXEMPT_FILE, 'utf8'));
    } catch {
        exemptFromHierarchy = [];
    }
}

function saveExempt() {
    fs.writeFileSync(EXEMPT_FILE, JSON.stringify(exemptFromHierarchy, null, 2));
}

loadGuilds();
loadExempt();

function getGuildData(guildId) {
    if (!guilds[guildId]) {
        guilds[guildId] = { whitelist: new Set(), managers: new Set() };
    }
    return guilds[guildId];
}

const permanentBlacklist = new Set();
let whitelistEnabled = false;
let logChannelId = null;
const joinAttempts = new Map();

const SETTINGS_FILE = 'settings.json';

function loadSettings() {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        const settings = JSON.parse(data);
        logChannelId = settings.logChannelId ?? null;
        whitelistEnabled = settings.whitelistEnabled ?? false;
    } catch (err) {
        logChannelId = null;
        whitelistEnabled = false;
    }
}

function saveSettings() {
    const settings = {
        logChannelId,
        whitelistEnabled
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

loadSettings();

try {
    const data = fs.readFileSync('permanent_blacklist.json', 'utf8');
    const parsedData = JSON.parse(data);
    parsedData.forEach(id => permanentBlacklist.add(id));
} catch (error) {}

const savePermanentBlacklist = () => {
    fs.writeFileSync('permanent_blacklist.json', JSON.stringify(Array.from(permanentBlacklist)));
};

const hellenkelleredUsers = new Set();
setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
        for (const userId of hellenkelleredUsers) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && member.voice.channel) {
                try {
                    if (!member.voice.serverMute) {
                        await member.voice.setMute(true, "Ensured hellenkellered by bot");
                    }
                    if (!member.voice.serverDeaf) {
                        await member.voice.setDeaf(true, "Ensured hellenkellered by bot");
                    }
                } catch (err) {}
            }
        }
    }
}, 60 * 1000);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix) && hellenkelleredUsers.has(message.author.id) && !message.author.bot) {
        message.reply("Stupid little wetard, just use your voice");
        return;
    }

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const guildId = message.guild?.id;
    if (!guildId) return;
    const guildData = getGuildData(guildId);

    if (!guildData.managers.has(message.author.id) && !exemptFromHierarchy.includes(message.author.id)) {
        return;
    }

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const logAction = (action, description) => {
        if (logChannelId) {
            const logChannel = client.channels.cache.get(logChannelId);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Command Log')
                    .addFields(
                        { name: 'Action', value: action, inline: true },
                        { name: 'Description', value: description, inline: true },
                        { name: 'Executed by', value: message.author.tag, inline: true }
                    )
                    .setTimestamp()
                    .setColor(0x000000);

                logChannel.send({ embeds: [embed] });
            }
        }
    };

    // Only OWNER_ID can add/remove exempt users
    if (command === 'addexempt') {
        if (message.author.id !== OWNER_ID) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to add as exempt.');
            return;
        }
        const userId = args[0];
        if (!exemptFromHierarchy.includes(userId)) {
            exemptFromHierarchy.push(userId);
            saveExempt();
            message.channel.send(`<@${userId}> has been added as globally exempt.`);
            logAction('addexempt', `Added <@${userId}> as globally exempt`);
        } else {
            message.channel.send(`<@${userId}> is already globally exempt.`);
        }
        return;
    } else if (command === 'delexempt') {
        if (message.author.id !== OWNER_ID) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to remove from exempt.');
            return;
        }
        const userId = args[0];
        if (exemptFromHierarchy.includes(userId)) {
            exemptFromHierarchy = exemptFromHierarchy.filter(id => id !== userId);
            saveExempt();
            message.channel.send(`<@${userId}> has been removed from global exempt.`);
            logAction('delexempt', `Removed <@${userId}> from global exempt`);
        } else {
            message.channel.send(`<@${userId}> is not globally exempt.`);
        }
        return;
    }

    if (command === 'addmanager') {
        if (!exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to add as manager.');
            return;
        }
        const userId = args[0];
        if (!guildData.managers.has(userId)) {
            guildData.managers.add(userId);
            saveGuilds();
            message.channel.send(`<@${userId}> has been added as a manager for this server.`);
            logAction('addmanager', `Added <@${userId}> as manager`);
        } else {
            message.channel.send(`<@${userId}> is already a manager for this server.`);
        }
        return;
    } else if (command === 'delmanager') {
        if (!exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to remove as manager.');
            return;
        }
        const userId = args[0];
        if (guildData.managers.has(userId)) {
            guildData.managers.delete(userId);
            saveGuilds();
            message.channel.send(`<@${userId}> has been removed as a manager for this server.`);
            logAction('delmanager', `Removed <@${userId}> as manager`);
        } else {
            message.channel.send(`<@${userId}> is not a manager for this server.`);
        }
        return;
    }

    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('Help Commands')
            .setDescription('Available commands:')
            .addFields(
                { name: '`help`', value: 'Show all commands and info about the bot.', inline: true },
                { name: '`whitelist <id>`', value: 'Add a user to the whitelist (per server).', inline: true },
                { name: '`removeuser <id>`', value: 'Remove a user from the whitelist and kick them from the server.', inline: true },
                { name: '`ban <id>`', value: 'Ban a user and remove from the whitelist.', inline: true },
                { name: '`togglewhitelist`', value: 'Enable or disable the whitelist feature.', inline: true },
                { name: '`setlogchannel <channelId>`', value: 'Set the channel where bot actions will be logged.', inline: true },
                { name: '`whitelistall`', value: 'Whitelist everyone in the server.', inline: true },
                { name: '`addmanager <id>`', value: 'Add a user as a manager for this server (exempt only).', inline: true },
                { name: '`delmanager <id>`', value: 'Remove a user as a manager for this server (exempt only).', inline: true },
                { name: '`addexempt <id>`', value: 'Add a user as globally exempt (owner only).', inline: true },
                { name: '`delexempt <id>`', value: 'Remove a user from globally exempt (owner only).', inline: true }
            )
            .setFooter({ text: 'Developed by <@398155693846167562>' })
            .setColor(0x000000);

        message.channel.send({ embeds: [embed] });
        logAction('help', 'Displayed help commands');
    } else if (command === 'whitelist') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !guildData.managers.has(message.author.id) && !exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to whitelist.');
            return;
        }
        const userId = args[0];
        if (permanentBlacklist.has(userId)) {
            message.channel.send(`<@${userId}> is permanently blacklisted and cannot be whitelisted.`);
            return;
        }
        guildData.whitelist.add(userId);
        saveGuilds();
        message.channel.send(`<@${userId}> has been added to the whitelist for this server.`);
        logAction('whitelist', `Added <@${userId}> to the whitelist`);
    } else if (command === 'removeuser') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !guildData.managers.has(message.author.id) && !exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to remove from the whitelist.');
            return;
        }
        const userId = args[0];
        const member = await message.guild.members.fetch(userId).catch(() => null);

        if (
            member &&
            !exemptFromHierarchy.includes(message.author.id) &&
            message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0
        ) {
            message.channel.send('You cannot remove a user with an equal or higher role.');
            return;
        }

        guildData.whitelist.delete(userId);
        saveGuilds();
        if (member) {
            await member.kick('Removed from the whitelist.');
            message.channel.send(`<@${userId}> has been removed from the whitelist and kicked from the server.`);
        } else {
            message.channel.send('User not found.');
        }
        logAction('removeuser', `Removed <@${userId}> from the whitelist and kicked from the server`);
    } else if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !guildData.managers.has(message.author.id) && !exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to ban.');
            return;
        }
        const userId = args[0];
        const member = await message.guild.members.fetch(userId).catch(() => null);

        if (
            member &&
            !exemptFromHierarchy.includes(message.author.id) &&
            message.member.roles.highest.comparePositionTo(member.roles.highest) <= 0
        ) {
            message.channel.send('You cannot ban a user with an equal or higher role.');
            return;
        }

        if (member) {
            await member.ban({ reason: 'Banned by bot command' });
            message.channel.send(`<@${userId}> has been banned and removed from the whitelist.`);
        } else {
            message.channel.send('User not found.');
        }
        guildData.whitelist.delete(userId);
        saveGuilds();
        logAction('ban', `Banned <@${userId}> and removed from the whitelist`);
    } else if (command === 'togglewhitelist') {
        whitelistEnabled = !whitelistEnabled;
        saveSettings();
        message.channel.send(`Whitelist feature has been ${whitelistEnabled ? 'enabled' : 'disabled'}.`);
        logAction('togglewhitelist', `Whitelist feature has been ${whitelistEnabled ? 'enabled' : 'disabled'}`);
    } else if (command === 'setlogchannel') {
        if (args.length === 0) {
            message.channel.send('Please provide a channel ID to set as the log channel.');
            return;
        }
        logChannelId = args[0];
        saveSettings();
        message.channel.send(`Log channel set to <#${logChannelId}>.`);
        logAction('setlogchannel', `Set log channel to <#${logChannelId}>`);
    } else if (command === 'whitelistall') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && !guildData.managers.has(message.author.id) && !exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        message.guild.members.fetch().then(members => {
            members.forEach(member => {
                if (!permanentBlacklist.has(member.id)) {
                    guildData.whitelist.add(member.id);
                }
            });
            saveGuilds();
            message.channel.send('All server members (except permanently blacklisted) have been added to the whitelist.');
            logAction('whitelistall', 'Added all server members to the whitelist');
        });
    } else if (command === 'pblacklist') {
        if (!exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length < 2) {
            message.channel.send('Usage: $pblacklist <discord id> <reason>');
            return;
        }
        const userId = args[0];
        const reason = args.slice(1).join(' ');
        permanentBlacklist.add(userId);

        for (const g of Object.values(guilds)) {
            g.whitelist.delete(userId);
        }
        savePermanentBlacklist();
        saveGuilds();
        message.channel.send(`<@${userId}> has been permanently blacklisted. Reason: ${reason}`);
        logAction('pblacklist', `Permanently blacklisted <@${userId}>. Reason: ${reason}`);
    } else if (command === 'unpblacklist') {
        if (!exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length < 2) {
            message.channel.send('Usage: $unpblacklist <discord id> <reason>');
            return;
        }
        const userId = args[0];
        const reason = args.slice(1).join(' ');
        if (permanentBlacklist.has(userId)) {
            permanentBlacklist.delete(userId);
            savePermanentBlacklist();
            message.channel.send(`<@${userId}> has been removed from the permanent blacklist. Reason: ${reason}`);
            logAction('unpblacklist', `Removed <@${userId}> from permanent blacklist. Reason: ${reason}`);
        } else {
            message.channel.send(`<@${userId}> is not on the permanent blacklist.`);
        }
    } else if (command === 'hellenkeller') {
        if (!exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to hellenkeller.');
            return;
        }
        const userId = args[0];
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (!member) {
            message.channel.send('User not found.');
            return;
        }
        try {
            await member.voice.setMute(true, "hellenkellered by bot");
            await member.voice.setDeaf(true, "hellenkellered by bot");
        } catch (err) {}
        hellenkelleredUsers.add(userId);
        message.channel.send(`<@${userId}> stupid little wetard, just learn to speak`);
        logAction('hellenkeller', `hellenkellered <@${userId}>`);
    } else if (command === 'unhellenkeller') {
        if (!exemptFromHierarchy.includes(message.author.id)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        if (args.length === 0) {
            message.channel.send('Please provide a user ID to unhellenkeller.');
            return;
        }
        const userId = args[0];
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member) {
            try {
                await member.voice.setMute(false, "Unhellenkellered by bot");
                await member.voice.setDeaf(false, "Unhellenkellered by bot");
            } catch (err) {}
        }
        hellenkelleredUsers.delete(userId);
        message.channel.send(`<@${userId}> has been unhellenkellered.`);
        logAction('unhellenkeller', `Unhellenkellered <@${userId}>`);
    }
});

client.on('guildMemberAdd', async member => {
    let attempts = joinAttempts.get(member.id) || 0;
    attempts += 1;
    joinAttempts.set(member.id, attempts);

    if (permanentBlacklist.has(member.id)) {
        await member.kick('Permanently blacklisted');
        const logChannel = client.channels.cache.get(logChannelId);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('User Kick Log')
                .addFields(
                    { name: 'Action', value: 'kick', inline: true },
                    { name: 'Description', value: `Permanently blacklisted: <@${member.id}>`, inline: true },
                    { name: 'User ID', value: member.id, inline: true }
                )
                .setTimestamp()
                .setColor(0x000000);
            logChannel.send({ embeds: [embed] });
        }
        return;
    }

    const guildId = member.guild.id;
    const guildData = getGuildData(guildId);

    if (whitelistEnabled && !guildData.whitelist.has(member.id)) {
        await member.kick('Not whitelisted');
        const logChannel = client.channels.cache.get(logChannelId);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('User Kick Log')
                .addFields(
                    { name: 'Action', value: 'kick', inline: true },
                    { name: 'Description', value: `Attempted to join but not whitelisted: <@${member.id}> (Attempt ${attempts})`, inline: true },
                    { name: 'User ID', value: member.id, inline: true }
                )
                .setTimestamp()
                .setColor(0x000000);
            logChannel.send({ embeds: [embed] });
        }

        if (attempts >= 2) {
            try {
                const invites = await member.guild.invites.fetch();
                for (const invite of invites.values()) {
                    await invite.delete('Wiped due to repeated join attempts by non-whitelisted user');
                }
                if (logChannelId) {
                    const logChannel = client.channels.cache.get(logChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle('Invites Wiped')
                            .setDescription(`All invites wiped after <@${member.id}> attempted to join twice without being whitelisted.`)
                            .setTimestamp()
                            .setColor(0xff0000);
                        logChannel.send({ embeds: [embed] });
                    }
                }
            } catch (err) {
                console.error('Failed to wipe invites:', err);
            }
        }
    }
});

client.login('YOUR_BOT_TOKEN_HERE');