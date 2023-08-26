const { Client, GatewayIntentBits, ActivityType, Collection, ChannelType } = require('discord.js');
const configs = require('./config.json');
require('colors');
const voiceData = new Collection();

const client = new Client({
    intents: [
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent
    ],
    presence: {
        activities: [{name: `Voice Channels`, type: ActivityType.Watching}],
        status: "idle" // "online", "dnd", "idle"
    }
});

// Anti Crash
process.on('unhandledRejection', (err, cause) => {
    if(err.code == 10008 || err.code == 10062) return;
    console.log(`[Uncaught Exception]: ${err}`.bold.brightGreen);
    console.log(cause)
});

process.on('uncaughtException', err => {
    console.log(`[Uncaught Exception] ${err.message}`.bold.brightGreen);
    console.log(err);
});


// Event Code: When voiceData of any Member is updated
client.on("voiceStateUpdate", async (oldState, newState) => {
    const member = oldState.member;
    const guild = oldState.guild;

    // implement mongodb here for Multi guild bot, to fetch variables from database rather than JSON file
    const channelid = configs.channelId; 
    const userlimit = configs.userLimit;
    const nameFormat = configs.nameFormat;
    const categoryid = configs.categoryId;
    const bitrate = configs.bitrate;
    const memberPerms = configs.memberPerms;
    const everyonePerms = configs.everyonePerms;

    // ---------------------------------------------
    if(!channelid || channelid.length == 0) return console.log(`[J2C Bot] Channel ID is missing in config.json File or unable to get it from Database.`.bold.brightRed);
    const j2c = guild.channels.cache.get(channelid);
    if(!j2c) return console.log(`[J2C Bot] J2C Channel ID is not Valid.`.bold.brightRed);

    // When user is reconnects due to network issues
    if(newState.channel?.id == oldState.channel?.id) return;

    // Member joins J2C Channel
    if(newState.channel?.id == channelid) {
        // If user shifts from existing J2C VC to J2C Channel
        const data = voiceData.get(member.id);
        if(data && data.channel == oldState.channel?.id) return await member.voice.setChannel(data.channel).catch(e => console.log(`[J2C Bot] Missing Move member permission.`.red));

        // Creating a new VC for the user
        let vcId = await guild.channels.create({
            name: `${nameFormat} ${member.displayName}`,
            type: ChannelType.GuildVoice,
            parent: categoryid.length == 0 ? j2c.parentId : categoryid,
	        bitrate: bitrate,
            permissionOverwrites: [
                {
                    id: member.id,
                    allow: [memberPerms],
                },
                {
                    id: guild.id,
                    allow: [everyonePerms],
                },
            ],
            userLimit: userlimit
        }).then(c => c.id, e => console.log(`[J2C Bot] Something went wrong while creating a new VC for ${member.displayName}: ${e}`.red));

        if(!vcId) return;
        // Data to store in collection: Modify the object according to your needs.
        voiceData.set(member.id, {channel: vcId, time: Date.now()});
        return await member.voice.setChannel(vcId).catch(e => console.log(`[J2C Bot] Missing Move member permission.`.red));
    }

    // Member leaves J2C VC
    const data = voiceData.get(member.id);
    if(!data) return;
    if(oldState.channel?.id != data.channel) return;
    const remainingMembers = oldState.channel.members.filter(m => !m.user.bot).map((m) => m.id);

    if(remainingMembers.length == 0) {
        oldState.channel.delete().catch(e => console.log(`[J2C Bot] Missing Channel Delete permission.`.red));
        return voiceData.delete(member.id);
    } else {
        let otherVcMember = await guild.members.fetch(remainingMembers[0]).catch(e => null);
        if(!otherVcMember) {
            oldState.channel.delete().catch(e => console.log(`[J2C Bot] Missing Channel Delete permission.`.red));
            return voiceData.delete(member.id);
        }

        oldState.channel.setName(`${nameFormat} ${otherVcMember.displayName}`).catch(e => null);
        voiceData.set(otherVcMember.id, {channel: oldState.channel.id, time: Date.now()});
        voiceData.delete(member.id);
    }
});

client.on('ready', () => {
    console.log(`

    ░░░░░██╗░█████╗░██╗███╗░░██╗░░░░░░████████╗░█████╗░░░░░░░░█████╗░██████╗░███████╗░█████╗░████████╗███████╗
    ░░░░░██║██╔══██╗██║████╗░██║░░░░░░╚══██╔══╝██╔══██╗░░░░░░██╔══██╗██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔════╝
    ░░░░░██║██║░░██║██║██╔██╗██║█████╗░░░██║░░░██║░░██║█████╗██║░░╚═╝██████╔╝█████╗░░███████║░░░██║░░░█████╗░░
    ██╗░░██║██║░░██║██║██║╚████║╚════╝░░░██║░░░██║░░██║╚════╝██║░░██╗██╔══██╗██╔══╝░░██╔══██║░░░██║░░░██╔══╝░░
    ╚█████╔╝╚█████╔╝██║██║░╚███║░░░░░░░░░██║░░░╚█████╔╝░░░░░░╚█████╔╝██║░░██║███████╗██║░░██║░░░██║░░░███████╗
    ░╚════╝░░╚════╝░╚═╝╚═╝░░╚══╝░░░░░░░░░╚═╝░░░░╚════╝░░░░░░░░╚════╝░╚═╝░░╚═╝╚══════╝╚═╝░░╚═╝░░░╚═╝░░░╚══════╝
`.blue.bold);

    console.log("----------------------------------------".blue);
    console.log(`[Djs v14: READY] ${client.user.tag} is up and ready to go.`.bold)
    console.log("----------------------------------------".white);
});

client.login(configs.token);