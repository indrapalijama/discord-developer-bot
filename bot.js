const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Initialize client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Collections to store data (in production, use a database)
client.snippets = new Collection();
client.learningGoals = new Collection();
client.studySessions = new Collection();

// Load environment variables
require('dotenv').config();

// Bot configuration
const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    prefix: process.env.BOT_PREFIX || '!',
    dailyReminderChannel: process.env.DAILY_REMINDER_CHANNEL || 'daily-coding',
    nodeEnv: process.env.NODE_ENV || 'development'
};

// Load saved data on startup
function loadData() {
    try {
        if (fs.existsSync('./data/snippets.json')) {
            const snippetData = JSON.parse(fs.readFileSync('./data/snippets.json', 'utf8'));
            client.snippets = new Collection(snippetData);
        }
        if (fs.existsSync('./data/goals.json')) {
            const goalData = JSON.parse(fs.readFileSync('./data/goals.json', 'utf8'));
            client.learningGoals = new Collection(goalData);
        }
        if (fs.existsSync('./data/challenges.json')) {
            const challengeData = JSON.parse(fs.readFileSync('./data/challenges.json', 'utf8'));
            client.userChallenges = new Collection(challengeData);
        }
    } catch (error) {
        console.log('No existing data found, starting fresh');
    }
}

// Save data to files
function saveData() {
    if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
    }
    fs.writeFileSync('./data/snippets.json', JSON.stringify([...client.snippets]));
    fs.writeFileSync('./data/goals.json', JSON.stringify([...client.learningGoals]));
    fs.writeFileSync('./data/challenges.json', JSON.stringify([...client.userChallenges]));
}

// Bot ready event
client.once('clientReady', () => {
    console.log(`${client.user.tag} is online and ready to help you learn!`);
    loadData();

    // Set bot activity
    client.user.setActivity('developers learn and grow', { type: 'WATCHING' });

    // Register slash commands
    registerSlashCommands();

    // Start daily reminder (every 24 hours)
    setInterval(sendDailyReminder, 24 * 60 * 60 * 1000);
});

// Register slash commands
async function registerSlashCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('snippet')
            .setDescription('Manage code snippets')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('save')
                    .setDescription('Save a code snippet')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Name of the snippet')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('code')
                            .setDescription('The code snippet')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('language')
                            .setDescription('Programming language')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('tags')
                            .setDescription('Tags (comma separated)')
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('get')
                    .setDescription('Get a saved snippet')
                    .addStringOption(option =>
                        option.setName('name')
                            .setDescription('Name of the snippet')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List all your snippets'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('search')
                    .setDescription('Search snippets by tag')
                    .addStringOption(option =>
                        option.setName('tag')
                            .setDescription('Tag to search for')
                            .setRequired(true))),

        new SlashCommandBuilder()
            .setName('goal')
            .setDescription('Manage learning goals')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('set')
                    .setDescription('Set a learning goal')
                    .addStringOption(option =>
                        option.setName('title')
                            .setDescription('Goal title')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('description')
                            .setDescription('Goal description')
                            .setRequired(false))
                    .addStringOption(option =>
                        option.setName('deadline')
                            .setDescription('Deadline (YYYY-MM-DD)')
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('complete')
                    .setDescription('Mark a goal as complete')
                    .addStringOption(option =>
                        option.setName('title')
                            .setDescription('Goal title')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List your learning goals')),

        new SlashCommandBuilder()
            .setName('challenge')
            .setDescription('Get a coding challenge'),

        new SlashCommandBuilder()
            .setName('docs')
            .setDescription('Search documentation')
            .addStringOption(option =>
                option.setName('query')
                    .setDescription('What to search for')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('source')
                    .setDescription('Documentation source')
                    .addChoices(
                        { name: 'MDN', value: 'mdn' },
                        { name: 'React', value: 'react' },
                        { name: 'Node.js', value: 'nodejs' },
                        { name: 'Python', value: 'python' }
                    )
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('timer')
            .setDescription('Start a coding session timer')
            .addIntegerOption(option =>
                option.setName('minutes')
                    .setDescription('Duration in minutes')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('task')
                    .setDescription('What you\'re working on')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('challenge-complete')
            .setDescription('Mark a challenge as completed')
            .addStringOption(option =>
                option.setName('title')
                    .setDescription('Challenge title (or part of it)')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('solution')
                    .setDescription('Your solution code')
                    .setRequired(false))
            .addStringOption(option =>
                option.setName('notes')
                    .setDescription('Notes about your approach')
                    .setRequired(false)),

        new SlashCommandBuilder()
            .setName('my-challenges')
            .setDescription('View your challenge progress')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('completed')
                    .setDescription('View completed challenges'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('stats')
                    .setDescription('View your challenge statistics')),

        // GitHub Integration
        new SlashCommandBuilder()
            .setName('github')
            .setDescription('GitHub integration commands')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('track')
                    .setDescription('Track a GitHub repository')
                    .addStringOption(option =>
                        option.setName('repo')
                            .setDescription('Repository URL or username/repo')
                            .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('commits')
                    .setDescription('Show recent commits from tracked repos'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List tracked repositories')),

        // Code Review System
        new SlashCommandBuilder()
            .setName('review')
            .setDescription('Code review system')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('submit')
                    .setDescription('Submit code for review')
                    .addStringOption(option =>
                        option.setName('title')
                            .setDescription('Review title')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('code')
                            .setDescription('Code to review')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('language')
                            .setDescription('Programming language')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('description')
                            .setDescription('What you want feedback on')
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List pending code reviews'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('feedback')
                    .setDescription('Give feedback on a code review')
                    .addIntegerOption(option =>
                        option.setName('id')
                            .setDescription('Review ID')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('feedback')
                            .setDescription('Your feedback')
                            .setRequired(true))),

        // Learning Resources
        new SlashCommandBuilder()
            .setName('learn')
            .setDescription('Learning resources and recommendations')
            .addStringOption(option =>
                option.setName('topic')
                    .setDescription('What do you want to learn?')
                    .addChoices(
                        { name: 'JavaScript', value: 'javascript' },
                        { name: 'React', value: 'react' },
                        { name: 'Node.js', value: 'nodejs' },
                        { name: 'Python', value: 'python' },
                        { name: 'Data Structures', value: 'datastructures' },
                        { name: 'Algorithms', value: 'algorithms' },
                        { name: 'System Design', value: 'systemdesign' },
                        { name: 'DevOps', value: 'devops' }
                    )
                    .setRequired(true)),

        // Progress Tracking
        new SlashCommandBuilder()
            .setName('progress')
            .setDescription('Track your learning progress')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('log')
                    .setDescription('Log a learning session')
                    .addStringOption(option =>
                        option.setName('topic')
                            .setDescription('What did you learn/work on?')
                            .setRequired(true))
                    .addIntegerOption(option =>
                        option.setName('hours')
                            .setDescription('How many hours?')
                            .setRequired(true))
                    .addStringOption(option =>
                        option.setName('notes')
                            .setDescription('Any notes or key takeaways?')
                            .setRequired(false)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('stats')
                    .setDescription('View your learning statistics'))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('week')
                    .setDescription('View this week\'s progress')),

        // Interview Prep
        new SlashCommandBuilder()
            .setName('interview')
            .setDescription('Interview preparation tools')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('question')
                    .setDescription('Get a random interview question')
                    .addStringOption(option =>
                        option.setName('type')
                            .setDescription('Type of question')
                            .addChoices(
                                { name: 'Technical', value: 'technical' },
                                { name: 'Behavioral', value: 'behavioral' },
                                { name: 'System Design', value: 'system' },
                                { name: 'Coding', value: 'coding' }
                            )))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('mock')
                    .setDescription('Start a mock interview session')),

        // Code Formatter
        new SlashCommandBuilder()
            .setName('format')
            .setDescription('Format code snippets')
            .addStringOption(option =>
                option.setName('code')
                    .setDescription('Code to format')
                    .setRequired(true))
            .addStringOption(option =>
                option.setName('language')
                    .setDescription('Programming language')
                    .addChoices(
                        { name: 'JavaScript', value: 'javascript' },
                        { name: 'Python', value: 'python' },
                        { name: 'Java', value: 'java' },
                        { name: 'C++', value: 'cpp' },
                        { name: 'HTML', value: 'html' },
                        { name: 'CSS', value: 'css' },
                        { name: 'SQL', value: 'sql' }
                    )
                    .setRequired(true))
    ];

    try {
        const rest = require('@discordjs/rest');
        const { Routes } = require('discord-api-types/v9');

        const restClient = new rest.REST({ version: '9' }).setToken(config.token);

        console.log('Started refreshing application (/) commands.');

        await restClient.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

// Handle slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'snippet') {
            await handleSnippetCommand(interaction);
        } else if (commandName === 'goal') {
            await handleGoalCommand(interaction);
        } else if (commandName === 'challenge') {
            await handleChallengeCommand(interaction);
        } else if (commandName === 'docs') {
            await handleDocsCommand(interaction);
        } else if (commandName === 'timer') {
            await handleTimerCommand(interaction);
        } else if (commandName === 'challenge-complete') {
            await handleChallengeCompleteCommand(interaction);
        } else if (commandName === 'my-challenges') {
            await handleMyChallengesCommand(interaction);
        } else if (commandName === 'github') {
            await handleGitHubCommand(interaction);
        } else if (commandName === 'review') {
            await handleReviewCommand(interaction);
        } else if (commandName === 'learn') {
            await handleLearnCommand(interaction);
        } else if (commandName === 'interview') {
            await handleInterviewCommand(interaction);
        } else if (commandName === 'progress') {
            await handleProgressCommand(interaction);
        } else if (commandName === 'format') {
            await handleFormatCommand(interaction);
        }
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

// Snippet command handler
async function handleSnippetCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'save') {
        const name = interaction.options.getString('name');
        const code = interaction.options.getString('code');
        const language = interaction.options.getString('language');
        const tags = interaction.options.getString('tags')?.split(',').map(t => t.trim()) || [];

        const snippetKey = `${userId}_${name}`;
        client.snippets.set(snippetKey, {
            name,
            code,
            language,
            tags,
            author: userId,
            createdAt: new Date().toISOString()
        });

        saveData();

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Snippet Saved!')
            .setDescription(`Saved snippet: **${name}**`)
            .addFields(
                { name: 'Language', value: language, inline: true },
                { name: 'Tags', value: tags.join(', ') || 'None', inline: true }
            );

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'get') {
        const name = interaction.options.getString('name');
        const snippetKey = `${userId}_${name}`;
        const snippet = client.snippets.get(snippetKey);

        if (!snippet) {
            await interaction.reply({ content: `❌ Snippet "${name}" not found!`, ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`📝 ${snippet.name}`)
            .setDescription(`\`\`\`${snippet.language}\n${snippet.code}\`\`\``)
            .addFields(
                { name: 'Language', value: snippet.language, inline: true },
                { name: 'Tags', value: snippet.tags.join(', ') || 'None', inline: true },
                { name: 'Created', value: new Date(snippet.createdAt).toLocaleDateString(), inline: true }
            );

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'list') {
        const userSnippets = [...client.snippets.entries()]
            .filter(([key, snippet]) => snippet.author === userId)
            .map(([key, snippet]) => snippet);

        if (userSnippets.length === 0) {
            await interaction.reply({ content: '📝 You have no saved snippets yet!', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📚 Your Code Snippets')
            .setDescription(userSnippets.map(s => `**${s.name}** (${s.language})`).join('\n'));

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'search') {
        const searchTag = interaction.options.getString('tag').toLowerCase();
        const matchingSnippets = [...client.snippets.entries()]
            .filter(([key, snippet]) =>
                snippet.author === userId &&
                snippet.tags.some(tag => tag.toLowerCase().includes(searchTag))
            )
            .map(([key, snippet]) => snippet);

        if (matchingSnippets.length === 0) {
            await interaction.reply({ content: `❌ No snippets found with tag "${searchTag}"`, ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🔍 Snippets with tag: ${searchTag}`)
            .setDescription(matchingSnippets.map(s => `**${s.name}** (${s.language})`).join('\n'));

        await interaction.reply({ embeds: [embed] });
    }
}

// Goal command handler
async function handleGoalCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'set') {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description') || 'No description provided';
        const deadline = interaction.options.getString('deadline');

        const goalKey = `${userId}_${title}`;
        client.learningGoals.set(goalKey, {
            title,
            description,
            deadline,
            completed: false,
            author: userId,
            createdAt: new Date().toISOString()
        });

        saveData();

        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle('🎯 Learning Goal Set!')
            .addFields(
                { name: 'Goal', value: title },
                { name: 'Description', value: description },
                { name: 'Deadline', value: deadline || 'No deadline set' }
            );

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'complete') {
        const title = interaction.options.getString('title');
        const goalKey = `${userId}_${title}`;
        const goal = client.learningGoals.get(goalKey);

        if (!goal) {
            await interaction.reply({ content: `❌ Goal "${title}" not found!`, ephemeral: true });
            return;
        }

        goal.completed = true;
        goal.completedAt = new Date().toISOString();
        client.learningGoals.set(goalKey, goal);
        saveData();

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 Goal Completed!')
            .setDescription(`Congratulations on completing: **${title}**`);

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'list') {
        const userGoals = [...client.learningGoals.entries()]
            .filter(([key, goal]) => goal.author === userId)
            .map(([key, goal]) => goal);

        if (userGoals.length === 0) {
            await interaction.reply({ content: '🎯 You have no learning goals set yet!', ephemeral: true });
            return;
        }

        const activeGoals = userGoals.filter(g => !g.completed);
        const completedGoals = userGoals.filter(g => g.completed);

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎯 Your Learning Goals');

        if (activeGoals.length > 0) {
            embed.addFields({
                name: '🔄 Active Goals',
                value: activeGoals.map(g => `**${g.title}** ${g.deadline ? `(Due: ${g.deadline})` : ''}`).join('\n')
            });
        }

        if (completedGoals.length > 0) {
            embed.addFields({
                name: '✅ Completed Goals',
                value: completedGoals.map(g => `**${g.title}**`).join('\n')
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
}

// Challenge command handler
async function handleChallengeCommand(interaction) {
    const challenges = [
        {
            title: "Array Manipulation",
            description: "Write a function that finds the second largest number in an array.",
            difficulty: "Easy",
            tags: ["arrays", "algorithms"]
        },
        {
            title: "String Reversal",
            description: "Reverse a string without using built-in reverse methods.",
            difficulty: "Easy",
            tags: ["strings", "algorithms"]
        },
        {
            title: "Binary Tree Traversal",
            description: "Implement in-order traversal of a binary tree.",
            difficulty: "Medium",
            tags: ["trees", "recursion"]
        },
        {
            title: "API Rate Limiter",
            description: "Design a rate limiter that allows N requests per minute.",
            difficulty: "Hard",
            tags: ["system-design", "algorithms"]
        },
        {
            title: "Responsive Navigation",
            description: "Create a mobile-first responsive navigation component.",
            difficulty: "Medium",
            tags: ["css", "frontend", "responsive"]
        }
    ];

    const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
    const userId = interaction.user.id;

    // Track that user received this challenge
    const challengeKey = `${userId}_${randomChallenge.title}`;
    if (!client.userChallenges.has(challengeKey)) {
        client.userChallenges.set(challengeKey, {
            userId,
            title: randomChallenge.title,
            description: randomChallenge.description,
            difficulty: randomChallenge.difficulty,
            tags: randomChallenge.tags,
            assignedAt: new Date().toISOString(),
            completed: false
        });
        saveData();
    }

    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('💪 Daily Coding Challenge')
        .addFields(
            { name: 'Challenge', value: randomChallenge.title },
            { name: 'Description', value: randomChallenge.description },
            { name: 'Difficulty', value: randomChallenge.difficulty, inline: true },
            { name: 'Tags', value: randomChallenge.tags.join(', '), inline: true }
        )
        .setFooter({ text: 'Use /challenge-complete when done! Share your solution in #code-review' });

    await interaction.reply({ embeds: [embed] });
}

async function handleChallengeCompleteCommand(interaction) {
    const userId = interaction.user.id;
    const titleQuery = interaction.options.getString('title').toLowerCase();
    const solution = interaction.options.getString('solution') || 'No solution provided';
    const notes = interaction.options.getString('notes') || 'No additional notes';

    // Find matching challenge
    const userChallenges = [...client.userChallenges.entries()]
        .filter(([key, challenge]) =>
            challenge.userId === userId &&
            challenge.title.toLowerCase().includes(titleQuery)
        );

    if (userChallenges.length === 0) {
        await interaction.reply({
            content: `❌ No challenge found matching "${titleQuery}". Try /challenge first or use the exact challenge title.`,
            ephemeral: true
        });
        return;
    }

    if (userChallenges.length > 1) {
        const matches = userChallenges.map(([key, challenge]) => challenge.title).join('\n');
        await interaction.reply({
            content: `❌ Multiple challenges found. Be more specific:\n${matches}`,
            ephemeral: true
        });
        return;
    }

    const [challengeKey, challenge] = userChallenges[0];

    if (challenge.completed) {
        await interaction.reply({
            content: `✅ You already completed "${challenge.title}"!`,
            ephemeral: true
        });
        return;
    }

    // Mark as completed
    challenge.completed = true;
    challenge.completedAt = new Date().toISOString();
    challenge.solution = solution;
    challenge.notes = notes;

    client.userChallenges.set(challengeKey, challenge);
    saveData();

    const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎉 Challenge Completed!')
        .addFields(
            { name: 'Challenge', value: challenge.title },
            { name: 'Difficulty', value: challenge.difficulty, inline: true },
            { name: 'Completed', value: new Date().toLocaleDateString(), inline: true }
        )
        .setFooter({ text: 'Great job! Try /challenge for another one!' });

    if (solution !== 'No solution provided') {
        embed.addFields({ name: 'Your Solution', value: `\`\`\`\n${solution.substring(0, 500)}${solution.length > 500 ? '...' : ''}\`\`\`` });
    }

    await interaction.reply({ embeds: [embed] });
}

// Add challenge progress handler
async function handleMyChallengesCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    const userChallenges = [...client.userChallenges.values()]
        .filter(challenge => challenge.userId === userId);

    if (userChallenges.length === 0) {
        await interaction.reply({ content: '💪 No challenges attempted yet! Use `/challenge` to get started.', ephemeral: true });
        return;
    }

    if (subcommand === 'completed') {
        const completedChallenges = userChallenges.filter(c => c.completed);

        if (completedChallenges.length === 0) {
            await interaction.reply({ content: '🎯 No challenges completed yet! Keep working!', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('✅ Your Completed Challenges')
            .setDescription(completedChallenges.map(c =>
                `**${c.title}** (${c.difficulty}) - ${new Date(c.completedAt).toLocaleDateString()}`
            ).join('\n'));

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'stats') {
        const completedCount = userChallenges.filter(c => c.completed).length;
        const pendingCount = userChallenges.filter(c => !c.completed).length;

        const difficultyStats = {};
        userChallenges.filter(c => c.completed).forEach(c => {
            difficultyStats[c.difficulty] = (difficultyStats[c.difficulty] || 0) + 1;
        });

        const embed = new EmbedBuilder()
            .setColor('#9c27b0')
            .setTitle('📊 Your Challenge Statistics')
            .addFields(
                { name: 'Completed', value: completedCount.toString(), inline: true },
                { name: 'Pending', value: pendingCount.toString(), inline: true },
                { name: 'Success Rate', value: `${Math.round((completedCount / userChallenges.length) * 100)}%`, inline: true }
            );

        if (Object.keys(difficultyStats).length > 0) {
            const difficultyBreakdown = Object.entries(difficultyStats)
                .map(([difficulty, count]) => `${difficulty}: ${count}`)
                .join('\n');
            embed.addFields({ name: 'By Difficulty', value: difficultyBreakdown });
        }

        await interaction.reply({ embeds: [embed] });
    }
}

// Documentation search handler
async function handleDocsCommand(interaction) {
    const query = interaction.options.getString('query');
    const source = interaction.options.getString('source') || 'mdn';

    const docUrls = {
        mdn: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query)}`,
        react: `https://reactjs.org/docs/getting-started.html#search=${encodeURIComponent(query)}`,
        nodejs: `https://nodejs.org/api/`,
        python: `https://docs.python.org/3/search.html?q=${encodeURIComponent(query)}`
    };

    const embed = new EmbedBuilder()
        .setColor('#4fc3f7')
        .setTitle(`📚 Documentation Search: ${query}`)
        .setDescription(`Search results for "${query}" in ${source.toUpperCase()}`)
        .addFields(
            { name: 'Direct Link', value: `[Click here to search](${docUrls[source]})` }
        );

    await interaction.reply({ embeds: [embed] });
}

// Timer command handler
async function handleTimerCommand(interaction) {
    const minutes = interaction.options.getInteger('minutes');
    const task = interaction.options.getString('task') || 'coding session';

    const embed = new EmbedBuilder()
        .setColor('#4caf50')
        .setTitle('⏰ Timer Started!')
        .setDescription(`${minutes} minute timer for: **${task}**`)
        .addFields(
            { name: 'Duration', value: `${minutes} minutes`, inline: true },
            { name: 'Task', value: task, inline: true }
        )
        .setFooter({ text: 'Focus and happy coding!' });

    await interaction.reply({ embeds: [embed] });

    // Set timer to notify when done
    setTimeout(async () => {
        const doneEmbed = new EmbedBuilder()
            .setColor('#ff9800')
            .setTitle('⏰ Timer Complete!')
            .setDescription(`Your ${minutes} minute session for **${task}** is complete!`)
            .setFooter({ text: 'Great job! Take a break or start another session.' });

        try {
            await interaction.followUp({ embeds: [doneEmbed] });
        } catch (error) {
            console.log('Could not send timer completion message');
        }
    }, minutes * 60 * 1000);
}

// Daily reminder function
async function sendDailyReminder() {
    client.guilds.cache.forEach(guild => {
        const channel = guild.channels.cache.find(ch => ch.name === config.dailyReminderChannel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#9c27b0')
                .setTitle('🌅 Daily Learning Reminder')
                .setDescription('Time to level up your coding skills!')
                .addFields(
                    { name: '💡 Today\'s Focus', value: 'What will you learn or build today?' },
                    { name: '🎯 Quick Tips', value: '• Use `/challenge` for a coding problem\n• Set a goal with `/goal set`\n• Save useful snippets with `/snippet save`' }
                )
                .setFooter({ text: 'Every day is a chance to grow! 🚀' });

            channel.send({ embeds: [embed] });
        }
    });
}

// GitHub command handler
async function handleGitHubCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'track') {
        const repo = interaction.options.getString('repo');
        let repoName = repo;

        // Extract repo name from URL if provided
        if (repo.includes('github.com')) {
            const match = repo.match(/github\.com\/([^\/]+\/[^\/]+)/);
            repoName = match ? match[1] : repo;
        }

        const repoKey = `${userId}_${repoName}`;
        client.githubRepos.set(repoKey, {
            name: repoName,
            url: `https://github.com/${repoName}`,
            trackedBy: userId,
            addedAt: new Date().toISOString()
        });

        saveData();

        const embed = new EmbedBuilder()
            .setColor('#24292e')
            .setTitle('📂 Repository Tracked!')
            .setDescription(`Now tracking: **${repoName}**`)
            .addFields(
                { name: 'Repository', value: `[${repoName}](https://github.com/${repoName})` }
            )
            .setFooter({ text: 'Use /github commits to see recent activity' });

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'list') {
        const userRepos = [...client.githubRepos.entries()]
            .filter(([key, repo]) => repo.trackedBy === userId)
            .map(([key, repo]) => repo);

        if (userRepos.length === 0) {
            await interaction.reply({ content: '📂 You\'re not tracking any repositories yet!', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#24292e')
            .setTitle('📂 Your Tracked Repositories')
            .setDescription(userRepos.map(r => `[${r.name}](${r.url})`).join('\n'));

        await interaction.reply({ embeds: [embed] });
    }
    // Note: For real commits, you'd need GitHub API integration
}

// Code Review command handler
async function handleReviewCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'submit') {
        const title = interaction.options.getString('title');
        const code = interaction.options.getString('code');
        const language = interaction.options.getString('language');
        const description = interaction.options.getString('description') || 'No specific feedback requested';

        const reviewId = Date.now(); // Simple ID generation
        client.codeReviews.set(reviewId.toString(), {
            id: reviewId,
            title,
            code,
            language,
            description,
            author: userId,
            authorName: interaction.user.username,
            feedback: [],
            status: 'pending',
            createdAt: new Date().toISOString()
        });

        saveData();

        const embed = new EmbedBuilder()
            .setColor('#ff9800')
            .setTitle('🔍 Code Review Submitted!')
            .setDescription(`**${title}** (ID: ${reviewId})`)
            .addFields(
                { name: 'Language', value: language, inline: true },
                { name: 'Status', value: 'Pending Review', inline: true },
                { name: 'Description', value: description },
                { name: 'Code', value: `\`\`\`${language}\n${code.substring(0, 1000)}${code.length > 1000 ? '...' : ''}\`\`\`` }
            )
            .setFooter({ text: 'Others can now provide feedback using /review feedback' });

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'list') {
        const pendingReviews = [...client.codeReviews.values()]
            .filter(review => review.status === 'pending')
            .slice(0, 10); // Limit to 10 most recent

        if (pendingReviews.length === 0) {
            await interaction.reply({ content: '🔍 No pending code reviews!', ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#ff9800')
            .setTitle('🔍 Pending Code Reviews')
            .setDescription(pendingReviews.map(r =>
                `**${r.id}**: ${r.title} (${r.language}) - by ${r.authorName}`
            ).join('\n'))
            .setFooter({ text: 'Use /review feedback [id] to provide feedback' });

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'feedback') {
        const reviewId = interaction.options.getInteger('id').toString();
        const feedback = interaction.options.getString('feedback');
        const review = client.codeReviews.get(reviewId);

        if (!review) {
            await interaction.reply({ content: '❌ Review not found!', ephemeral: true });
            return;
        }

        review.feedback.push({
            author: userId,
            authorName: interaction.user.username,
            feedback: feedback,
            timestamp: new Date().toISOString()
        });

        client.codeReviews.set(reviewId, review);
        saveData();

        const embed = new EmbedBuilder()
            .setColor('#4caf50')
            .setTitle('💬 Feedback Added!')
            .setDescription(`Feedback added to review: **${review.title}**`)
            .addFields(
                { name: 'Your Feedback', value: feedback }
            );

        await interaction.reply({ embeds: [embed] });
    }
}

// Learning Resources command handler
async function handleLearnCommand(interaction) {
    const topic = interaction.options.getString('topic');

    const resources = {
        javascript: {
            title: 'JavaScript Learning Path',
            color: '#f7df1e',
            resources: [
                '📖 [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)',
                '📚 [JavaScript.info](https://javascript.info/)',
                '🎥 [JavaScript Crash Course](https://www.youtube.com/watch?v=hdI2bqOjy3c)',
                '💪 [JavaScript30](https://javascript30.com/)',
                '🧪 [Codewars JavaScript](https://www.codewars.com/?language=javascript)'
            ]
        },
        react: {
            title: 'React Learning Path',
            color: '#61dafb',
            resources: [
                '📖 [Official React Docs](https://reactjs.org/docs/getting-started.html)',
                '🎥 [React Tutorial for Beginners](https://www.youtube.com/watch?v=Ke90Tje7VS0)',
                '💪 [React Challenges](https://react-challenges.vercel.app/)',
                '🛠️ [Create React App](https://create-react-app.dev/)',
                '📚 [React Router](https://reactrouter.com/)'
            ]
        },
        python: {
            title: 'Python Learning Path',
            color: '#3776ab',
            resources: [
                '📖 [Python.org Tutorial](https://docs.python.org/3/tutorial/)',
                '📚 [Real Python](https://realpython.com/)',
                '💪 [HackerRank Python](https://www.hackerrank.com/domains/python)',
                '🎥 [Python Crash Course](https://www.youtube.com/watch?v=rfscVS0vtbw)',
                '🧪 [LeetCode Python](https://leetcode.com/problemset/all/?languageTags=python)'
            ]
        },
        algorithms: {
            title: 'Algorithms & Data Structures',
            color: '#ff6b6b',
            resources: [
                '📖 [Introduction to Algorithms (CLRS)](https://mitpress.mit.edu/books/introduction-algorithms-third-edition)',
                '🎥 [MIT 6.006 Introduction to Algorithms](https://www.youtube.com/playlist?list=PLUl4u3cNGP61Oq3tWYp6V_F-5jb5L2iHb)',
                '💪 [LeetCode](https://leetcode.com/)',
                '📚 [Algorithm Visualizer](https://algorithm-visualizer.org/)',
                '🧪 [HackerRank Algorithms](https://www.hackerrank.com/domains/algorithms)'
            ]
        },
        systemdesign: {
            title: 'System Design',
            color: '#9c27b0',
            resources: [
                '📖 [System Design Primer](https://github.com/donnemartin/system-design-primer)',
                '🎥 [System Design Interview](https://www.youtube.com/c/SystemDesignInterview)',
                '📚 [High Scalability](http://highscalability.com/)',
                '💪 [System Design Questions](https://github.com/checkcheckzz/system-design-interview)',
                '🛠️ [AWS Architecture Center](https://aws.amazon.com/architecture/)'
            ]
        }
    };

    const topicData = resources[topic];
    if (!topicData) {
        await interaction.reply({ content: '❌ Topic not found!', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setColor(topicData.color)
        .setTitle(`🎓 ${topicData.title}`)
        .setDescription('Here are some curated resources to help you learn:')
        .addFields({
            name: 'Recommended Resources',
            value: topicData.resources.join('\n')
        })
        .setFooter({ text: 'Happy learning! Set a goal with /goal set' });

    await interaction.reply({ embeds: [embed] });
}

// Interview Prep command handler
async function handleInterviewCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'question') {
        const type = interaction.options.getString('type') || 'technical';

        const questions = {
            technical: [
                "Explain the difference between `let`, `const`, and `var` in JavaScript.",
                "What is the difference between SQL and NoSQL databases?",
                "Explain REST API principles and HTTP methods.",
                "What is the difference between synchronous and asynchronous programming?",
                "Explain the concept of Big O notation."
            ],
            behavioral: [
                "Tell me about a challenging project you worked on.",
                "How do you handle tight deadlines?",
                "Describe a time when you had to learn a new technology quickly.",
                "How do you approach debugging a complex problem?",
                "Tell me about a time you received constructive feedback."
            ],
            system: [
                "Design a URL shortening service like bit.ly",
                "How would you design a chat application like WhatsApp?",
                "Design a caching system for a web application.",
                "How would you design a social media feed?",
                "Design a file storage system like Dropbox."
            ],
            coding: [
                "Write a function to reverse a linked list.",
                "Find the two numbers in an array that sum to a target.",
                "Implement a function to check if a string is a palindrome.",
                "Write code to find the longest substring without repeating characters.",
                "Implement a binary search algorithm."
            ]
        };

        const questionList = questions[type];
        const randomQuestion = questionList[Math.floor(Math.random() * questionList.length)];

        const embed = new EmbedBuilder()
            .setColor('#2196f3')
            .setTitle(`🎯 ${type.charAt(0).toUpperCase() + type.slice(1)} Interview Question`)
            .setDescription(randomQuestion)
            .addFields(
                {
                    name: 'Tips', value: type === 'coding' ?
                        '• Think out loud\n• Start with a brute force approach\n• Consider edge cases\n• Optimize if possible' :
                        type === 'behavioral' ?
                            '• Use the STAR method (Situation, Task, Action, Result)\n• Be specific with examples\n• Focus on your role and contributions' :
                            '• Ask clarifying questions\n• Start with high-level design\n• Consider scalability and trade-offs'
                }
            )
            .setFooter({ text: 'Take your time to think through the answer!' });

        await interaction.reply({ embeds: [embed] });
    }
}

// Progress Tracking command handler  
async function handleProgressCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === 'log') {
        const topic = interaction.options.getString('topic');
        const hours = interaction.options.getInteger('hours');
        const notes = interaction.options.getString('notes') || 'No notes provided';

        if (!client.progressLogs) client.progressLogs = new Collection();

        const logEntry = {
            userId,
            topic,
            hours,
            notes,
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        };

        const logKey = `${userId}_${Date.now()}`;
        client.progressLogs.set(logKey, logEntry);

        const embed = new EmbedBuilder()
            .setColor('#4caf50')
            .setTitle('📊 Progress Logged!')
            .addFields(
                { name: 'Topic', value: topic, inline: true },
                { name: 'Hours', value: hours.toString(), inline: true },
                { name: 'Date', value: logEntry.date, inline: true },
                { name: 'Notes', value: notes }
            )
            .setFooter({ text: 'Great job! Keep up the learning momentum!' });

        await interaction.reply({ embeds: [embed] });

    } else if (subcommand === 'stats') {
        if (!client.progressLogs) {
            await interaction.reply({ content: '📊 No progress logged yet!', ephemeral: true });
            return;
        }

        const userLogs = [...client.progressLogs.values()].filter(log => log.userId === userId);

        if (userLogs.length === 0) {
            await interaction.reply({ content: '📊 No progress logged yet!', ephemeral: true });
            return;
        }

        const totalHours = userLogs.reduce((sum, log) => sum + log.hours, 0);
        const topicStats = {};

        userLogs.forEach(log => {
            topicStats[log.topic] = (topicStats[log.topic] || 0) + log.hours;
        });

        const topTopics = Object.entries(topicStats)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([topic, hours]) => `${topic}: ${hours}h`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor('#9c27b0')
            .setTitle('📊 Your Learning Statistics')
            .addFields(
                { name: 'Total Hours Logged', value: totalHours.toString(), inline: true },
                { name: 'Sessions Logged', value: userLogs.length.toString(), inline: true },
                { name: 'Average per Session', value: `${(totalHours / userLogs.length).toFixed(1)}h`, inline: true },
                { name: 'Top Topics', value: topTopics || 'No data yet' }
            )
            .setFooter({ text: 'Keep up the great work!' });

        await interaction.reply({ embeds: [embed] });
    }
}

// Format code command handler
async function handleFormatCommand(interaction) {
    const code = interaction.options.getString('code');
    const language = interaction.options.getString('language');

    // Simple formatting - in production you'd use a proper formatter
    const formattedCode = code
        .replace(/;/g, ';\n')
        .replace(/\{/g, '{\n  ')
        .replace(/\}/g, '\n}')
        .replace(/,/g, ',\n');

    const embed = new EmbedBuilder()
        .setColor('#795548')
        .setTitle('🎨 Formatted Code')
        .setDescription(`\`\`\`${language}\n${formattedCode}\`\`\``)
        .setFooter({ text: 'Code formatting completed!' });

    await interaction.reply({ embeds: [embed] });
}

// Welcome new members
client.on('guildMemberAdd', member => {
    const welcomeEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('Welcome to the Learning Community! 🎉')
        .setDescription(`Hey ${member.user.username}! Ready to level up your coding skills?`)
        .addFields(
            { name: '🚀 Getting Started', value: 'Use `/challenge` to get a coding challenge!' },
            { name: '📝 Save Code', value: 'Use `/snippet save` to store useful code snippets' },
            { name: '🎯 Set Goals', value: 'Use `/goal set` to track your learning objectives' }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'Happy coding! 💻' });

    const welcomeChannel = member.guild.channels.cache.find(ch => ch.name === 'general');
    if (welcomeChannel) {
        welcomeChannel.send({ embeds: [welcomeEmbed] });
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    saveData();
    client.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    saveData();
    client.destroy();
    process.exit(0);
});

// Health check endpoint for Railway
const http = require('http');
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
});

// Validate required environment variables
if (!config.token) {
    console.error('❌ DISCORD_TOKEN is required! Please set it in your environment variables.');
    process.exit(1);
}

if (!config.clientId) {
    console.error('❌ DISCORD_CLIENT_ID is required! Please set it in your environment variables.');
    process.exit(1);
}

// Login to Discord
client.login(config.token);