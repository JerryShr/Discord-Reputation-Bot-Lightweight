// index.js
// 需要的套件：discord.js、chart.js、chartjs-node-canvas
// npm i discord.js chart.js chartjs-node-canvas

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  AttachmentBuilder,
  MessageFlags
} = require('discord.js');
const { appendFileSync, readFileSync, existsSync } = require('fs');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const { token, clientId, guildId, channelId } = require('./config.json');

// 匿名顯示設定（預設為顯示）
let anonymousSettings = {
  showAvatar: true,
  showUsername: true
};

// ─────────────────────────────────────────────────────
// 建立 Client
// ─────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

// ─────────────────────────────────────────────────────
// Slash 指令定義與註冊
// ─────────────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('review')
    .setDescription('給予商品評價'),

  new SlashCommandBuilder()
    .setName('toggle_anonymous')
    .setDescription('切換匿名顯示設定（頭像/用戶名稱）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('stats_reviews')
    .setDescription('顯示評價統計（橫向條狀圖 + 平均分）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('search_reviews')
    .setDescription('搜尋評論（內容 / 用戶名稱 / 商品名稱）')
    .addStringOption(opt =>
      opt.setName('keyword')
        .setDescription('關鍵字')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('export_reviews')
    .setDescription('匯出所有評論記錄檔')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(token);
(async () => {
  try {
    console.log('🔄 註冊 Slash 指令中...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('✅ 指令註冊完成');
  } catch (e) {
    console.error('指令註冊失敗：', e);
  }
})();

client.once('ready', () => {
  console.log(`🤖 已登入：${client.user.tag}`);
});

// ─────────────────────────────────────────────────────
// 互動事件處理
// ─────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // /review → 彈出評價表單
  if (interaction.isChatInputCommand() && interaction.commandName === 'review') {
    const modal = new ModalBuilder()
      .setCustomId('reviewModal')
      .setTitle('提交評價');

    const productInput = new TextInputBuilder()
      .setCustomId('product')
      .setLabel('商品名稱')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('請輸入商品名稱')
      .setRequired(true);

    const starsInput = new TextInputBuilder()
      .setCustomId('stars')
      .setLabel('評分 (1~5)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('輸入 1~5')
      .setRequired(true);

    const commentInput = new TextInputBuilder()
      .setCustomId('comment')
      .setLabel('評論 (選填)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('請輸入你的評論（可留空）')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(productInput),
      new ActionRowBuilder().addComponents(starsInput),
      new ActionRowBuilder().addComponents(commentInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // /toggle_anonymous → 管理員互動式設定
  if (interaction.isChatInputCommand() && interaction.commandName === 'toggle_anonymous') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ 你沒有權限使用此指令', flags: MessageFlags.Ephemeral });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('toggleAnonymousMenu')
      .setPlaceholder('選擇要切換的顯示設定')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel(`顯示用戶頭像（目前：${anonymousSettings.showAvatar ? '開' : '關'}）`).setValue('toggleAvatar'),
        new StringSelectMenuOptionBuilder().setLabel(`顯示用戶名稱（目前：${anonymousSettings.showUsername ? '開' : '關'}）`).setValue('toggleUsername')
      );

    await interaction.reply({
      content: '⚙️ 請選擇要切換的設定：',
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // /stats_reviews → 橫向條狀圖 + 平均分
  if (interaction.isChatInputCommand() && interaction.commandName === 'stats_reviews') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ 你沒有權限使用此指令', flags: MessageFlags.Ephemeral });
    }

    if (!existsSync('./reviews.log')) {
      return interaction.reply({ content: '⚠️ 尚無評論記錄', flags: MessageFlags.Ephemeral });
    }

    const reviews = readFileSync('./reviews.log', 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    if (reviews.length === 0) {
      return interaction.reply({ content: '⚠️ 尚無評論記錄', flags: MessageFlags.Ephemeral });
    }

    // 計算統計
    const starCounts = [0, 0, 0, 0, 0]; // index 0 -> 1⭐
    let totalStars = 0;
    for (const r of reviews) {
      if (r.stars >= 1 && r.stars <= 5) {
        starCounts[r.stars - 1]++;
        totalStars += r.stars;
      }
    }
    const avg = (totalStars / reviews.length).toFixed(2);

    // 產圖（橫向條狀圖）
    const width = 840;
    const height = 420;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
    const configuration = {
      type: 'bar',
      data: {
        labels: ['1⭐', '2⭐', '3⭐', '4⭐', '5⭐'],
        datasets: [{
          label: '評價數量',
          data: starCounts,
          backgroundColor: ['#ff4d4d', '#ff944d', '#ffd24d', '#b3ff4d', '#4dff88']
        }]
      },
      options: {
        responsive: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          title: { display: true, text: '評分統計圖' }
        },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    };
    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    const file = new AttachmentBuilder(buffer, { name: 'stats.png' });

    await interaction.reply({
      content: `📊 評價統計\n⭐ 平均評分：**${avg}** / 5（共 ${reviews.length} 筆）`,
      files: [file],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // /search_reviews → 關鍵字（內容 / 名稱 / 商品）
  if (interaction.isChatInputCommand() && interaction.commandName === 'search_reviews') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ 你沒有權限使用此指令', flags: MessageFlags.Ephemeral });
    }

    const keyword = interaction.options.getString('keyword').toLowerCase();

    if (!existsSync('./reviews.log')) {
      return interaction.reply({ content: '⚠️ 尚無評論記錄', flags: MessageFlags.Ephemeral });
    }

    const reviews = readFileSync('./reviews.log', 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    const matched = reviews.filter(r =>
      (r.comment || '').toLowerCase().includes(keyword) ||
      (r.username || '').toLowerCase().includes(keyword) ||
      (r.product || '').toLowerCase().includes(keyword)
    );

    if (matched.length === 0) {
      return interaction.reply({ content: `🔍 找不到包含「${keyword}」的評論`, flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ae86)
      .setTitle(`🔍 搜尋結果（${matched.length} 筆）`)
      .setTimestamp();

    matched.slice(0, 10).forEach((r, idx) => {
      const starEmoji = '⭐'.repeat(r.stars || 0) || '（無）';
      embed.addFields({
        name: `${idx + 1}. ${r.product || '（未填商品）'}｜${r.username || '（匿名）'}`,
        value: `評分：${starEmoji}\n評論：${r.comment || '（無評論）'}\n時間：${new Date(r.timestamp).toLocaleString('zh-TW')}`
      });
    });

    if (matched.length > 10) {
      embed.setFooter({ text: `僅顯示前 10 筆，共 ${matched.length} 筆` });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  // /export_reviews → 匯出 reviews.log
  if (interaction.isChatInputCommand() && interaction.commandName === 'export_reviews') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ 你沒有權限使用此指令', flags: MessageFlags.Ephemeral });
    }
    if (!existsSync('./reviews.log')) {
      return interaction.reply({ content: '⚠️ 尚無評論記錄', flags: MessageFlags.Ephemeral });
    }

    const file = new AttachmentBuilder('./reviews.log', { name: 'reviews.log' });
    await interaction.reply({
      content: '📤 以下是評論記錄檔案：',
      files: [file],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  // Modal 提交（送出評價）
  if (interaction.isModalSubmit() && interaction.customId === 'reviewModal') {
    const product = interaction.fields.getTextInputValue('product');
    const stars = parseInt(interaction.fields.getTextInputValue('stars'), 10);
    const comment = interaction.fields.getTextInputValue('comment') || '（無評論）';

    if (isNaN(stars) || stars < 1 || stars > 5) {
      return interaction.reply({ content: '❌ 請輸入 1~5 的評分', flags: MessageFlags.Ephemeral });
    }

    // 儲存記錄
    const entry = {
      username: interaction.user.username,
      userId: interaction.user.id,
      product,
      stars,
      comment,
      timestamp: new Date().toISOString()
    };
    appendFileSync('./reviews.log', JSON.stringify(entry) + '\n', 'utf8');

    // 發送到指定評價頻道（照你指定的格式）
    const starEmoji = '⭐'.repeat(stars);
    const colors = [0xff4d4d, 0xff944d, 0xffd24d, 0xb3ff4d, 0x4dff88, 0x4da6ff];
    const nowText = new Date().toLocaleString('zh-TW'); // 例如：2025/8/14 下午4:21

    const authorName = `📢 ${(anonymousSettings.showUsername ? interaction.user.username : '匿名')} 的評價`;
    const authorIcon = anonymousSettings.showAvatar ? interaction.user.displayAvatarURL() : null;

    const embed = new EmbedBuilder()
      .setColor(colors[Math.floor(Math.random() * colors.length)])
      .setAuthor({ name: authorName, iconURL: authorIcon ?? undefined })
      .addFields(
        { name: '商品', value: product, inline: false },
        { name: '評分', value: starEmoji, inline: false },
        { name: '評論', value: comment, inline: false }
      )
      .setFooter({ text: nowText })
      .setTimestamp();

    const channel = await client.channels.fetch(channelId);
    await channel.send({ embeds: [embed] });

    // 給使用者的回覆（僅自己可見）
    await interaction.reply({ content: '✅ 感謝你的評價！', flags: MessageFlags.Ephemeral });
    return;
  }

  // 下拉式選單 → 切換匿名設定
  if (interaction.isStringSelectMenu() && interaction.customId === 'toggleAnonymousMenu') {
    for (const v of interaction.values) {
      if (v === 'toggleAvatar') anonymousSettings.showAvatar = !anonymousSettings.showAvatar;
      if (v === 'toggleUsername') anonymousSettings.showUsername = !anonymousSettings.showUsername;
    }
    await interaction.update({
      content: `✅ 設定已更新：\n顯示頭像：${anonymousSettings.showAvatar ? '開' : '關'}\n顯示名稱：${anonymousSettings.showUsername ? '開' : '關'}`,
      components: []
    });
    return;
  }
});

client.login(token);
