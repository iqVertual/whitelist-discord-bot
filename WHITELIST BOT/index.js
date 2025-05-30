const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });

const prefix = "$";
const whitelist = new Set();
const permanentBlacklist = new Set();
let whitelistEnabled = false;
let logChannelId = null;
const joinAttempts = new Map();

// This allows users to add and remove users from the Whitelist
const allowedUsers = [
    "398155693846167562",
    "DISCORD ID HERE",
    "DISCORD ID HERE"
];
// This exempts users from role hierarchy checks when running removal commands such as bans or removeuser
const exemptFromHierarchy = [
    "398155693846167562",
    "DISCORD ID HERE",
    "DISCORD ID HERE",
    "DISCORD ID HERE",
    "DISCORD ID HERE"
];


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
                } catch (err) {
                    
                }
            }
        }
    }
}, 60 * 1000); 
try {
    const data = fs.readFileSync('whitelist.json', 'utf8');
    const parsedData = JSON.parse(data);
    parsedData.forEach(id => whitelist.add(id));
} catch (error) {
    console.error('Error loading whitelist:', error);
}

try {
    const data = fs.readFileSync('permanent_blacklist.json', 'utf8');
    const parsedData = JSON.parse(data);
    parsedData.forEach(id => permanentBlacklist.add(id));
} catch (error) {

}

const saveWhitelist = () => {
    fs.writeFileSync('whitelist.json', JSON.stringify(Array.from(whitelist)));
};

const savePermanentBlacklist = () => {
    fs.writeFileSync('permanent_blacklist.json', JSON.stringify(Array.from(permanentBlacklist)));
};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {

    if (!message.content.startsWith(prefix) && hellenkelleredUsers.has(message.author.id) && !message.author.bot) {
        message.reply("Stupid little wetard, just use your voice");
        return;
    }

    if (!message.content.startsWith(prefix) || message.author.bot) return;

    if (!allowedUsers.includes(message.author.id)) {
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

    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setTitle('Help Commands')
            .setDescription('Available commands:')
            .addFields(
                { name: '`help`', value: 'Show all commands and info about the bot.', inline: true },
                { name: '`whitelist <id>`', value: 'Add a user to the whitelist.', inline: true },
                { name: '`removeuser <id>`', value: 'Remove a user from the whitelist and kick them from the server.', inline: true },
                { name: '`ban <id>`', value: 'Ban a user and remove from the whitelist.', inline: true },
                { name: '`togglewhitelist`', value: 'Enable or disable the whitelist feature.', inline: true },
                { name: '`setlogchannel <channelId>`', value: 'Set the channel where bot actions will be logged.', inline: true },
                { name: '`whitelistall`', value: 'Whitelist everyone in the server.', inline: true },
            )
            .setFooter({ text: 'Developed by <@398155693846167562>' })
            .setColor(0x000000);

        message.channel.send({ embeds: [embed] });
        logAction('help', 'Displayed help commands');
    } else if (command === 'whitelist') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
        whitelist.add(userId);
        saveWhitelist();
        message.channel.send(`<@${userId}> has been added to the whitelist.`);
        logAction('whitelist', `Added <@${userId}> to the whitelist`);
    } else if (command === 'removeuser') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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

        whitelist.delete(userId);
        saveWhitelist();
        if (member) {
            await member.kick('Removed from the whitelist.');
            message.channel.send(`<@${userId}> has been removed from the whitelist and kicked from the server.`);
        } else {
            message.channel.send('User not found.');
        }
        logAction('removeuser', `Removed <@${userId}> from the whitelist and kicked from the server`);
    } else if (command === 'ban') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
        whitelist.delete(userId);
        saveWhitelist();
        logAction('ban', `Banned <@${userId}> and removed from the whitelist`);
    } else if (command === 'togglewhitelist') {
        whitelistEnabled = !whitelistEnabled;
        message.channel.send(`Whitelist feature has been ${whitelistEnabled ? 'enabled' : 'disabled'}.`);
        logAction('togglewhitelist', `Whitelist feature has been ${whitelistEnabled ? 'enabled' : 'disabled'}`);
    } else if (command === 'setlogchannel') {
        if (args.length === 0) {
            message.channel.send('Please provide a channel ID to set as the log channel.');
            return;
        }
        logChannelId = args[0];
        message.channel.send(`Log channel set to <#${logChannelId}>.`);
        logAction('setlogchannel', `Set log channel to <#${logChannelId}>`);
    } else if (command === 'whitelistall') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            message.channel.send('You do not have permission to use this command.');
            return;
        }
        message.guild.members.fetch().then(members => {
            members.forEach(member => {
                if (!permanentBlacklist.has(member.id)) {
                    whitelist.add(member.id);
                }
            });
            saveWhitelist();
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
        whitelist.delete(userId);
        savePermanentBlacklist();
        saveWhitelist();
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
        } catch (err) {

        }
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
            } catch (err) {

            }
        }
        hellenkelleredUsers.delete(userId);
        message.channel.send(`<@${userId}> has been unhellenkellered.`);
        logAction('unhellenkeller', `Unhellenkellered <@${userId}>`);
    }
});

client.on('guildMemberAdd', async member => {
    // Track join attempts
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


    if (whitelistEnabled && !whitelist.has(member.id)) {
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

client.login('DISCORD TOKEN HERE!');