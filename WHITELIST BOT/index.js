const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });

const prefix = "$";
const whitelist = new Set();
let whitelistEnabled = false;
let logChannelId = null;

// Load whitelist from file
try {
    const data = fs.readFileSync('whitelist.json', 'utf8');
    const parsedData = JSON.parse(data);
    parsedData.forEach(id => whitelist.add(id));
} catch (error) {
    console.error('Error loading whitelist:', error);
}

// Save whitelist to file
const saveWhitelist = () => {
    fs.writeFileSync('whitelist.json', JSON.stringify(Array.from(whitelist)));
};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

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
                    .setColor(0x000000);  // Set color to black

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
                { name: '`whitelistall`', value: 'Whitelist everyone in the server.', inline: true }
            )
            .setFooter({ text: 'Developed by <@398155693846167562>' })
            .setColor(0x000000);  // Set color to black

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
        whitelist.delete(userId);
        saveWhitelist();
        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (member && whitelistEnabled) {
            await member.kick('Removed from the whitelist.');
            message.channel.send(`<@${userId}> has been removed from the whitelist and kicked from the server.`);
        } else if (member) {
            message.channel.send(`<@${userId}> has been removed from the whitelist.`);
        } else {
            message.channel.send('User not found.');
        }
        logAction('removeuser', `Removed <@${userId}> from the whitelist${whitelistEnabled ? ' and kicked from the server' : ''}`);
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
                whitelist.add(member.id);
            });
            saveWhitelist();
            message.channel.send('All server members have been added to the whitelist.');
            logAction('whitelistall', 'Added all server members to the whitelist');
        });
    }
});

client.on('guildMemberAdd', member => {
    if (whitelistEnabled && !whitelist.has(member.id)) {
        member.kick('Not whitelisted');
        const logChannel = client.channels.cache.get(logChannelId);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('User Kick Log')
                .addFields(
                    { name: 'Action', value: 'kick', inline: true },
                    { name: 'Description', value: `Attempted to join but not whitelisted: <@${member.id}>`, inline: true },
                    { name: 'User ID', value: member.id, inline: true }
                )
                .setTimestamp()
                .setColor(0x000000);  // Set color to black

            logChannel.send({ embeds: [embed] });
        }
    }
});

client.login('');
