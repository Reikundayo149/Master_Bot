import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, AttachmentBuilder } from 'discord.js';
import { createEvent, updateEventMessageId, upsertAttendance, updateComment, getEventWithAttendance, getActiveEvents } from '../utils/supabase.mjs';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';

/**
 * メンバー用出欠パネルのEmbedとComponentを生成する
 */
function buildAttendancePanel(event, attendances) {
  const attendCount = attendances.filter(a => a.status === 'attend').length;
  const absentCount = attendances.filter(a => a.status === 'absent').length;
  const lateCount = attendances.filter(a => a.status === 'late').length;

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${event.title}`)
    .setColor('#0099ff')
    .addFields(
      { name: '日時', value: event.event_date || '未定', inline: true },
      { name: '場所', value: event.location || '未定', inline: true },
      { name: '詳細', value: event.description || 'なし' },
      { name: 'リアルタイム集計', value: `🟢 出席: **${attendCount}** 名\n🔴 欠席: **${absentCount}** 名\n🟡 遅刻/早退: **${lateCount}** 名` }
    )
    .setFooter({ text: `イベントID: ${event.id}` })
    .setTimestamp();

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setCustomId(`attend_${event.id}`).setLabel('出席').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`absent_${event.id}`).setLabel('欠席').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`late_${event.id}`).setLabel('遅刻/早退').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`comment_${event.id}`).setLabel('備考(任意)').setStyle(ButtonStyle.Primary)
    );

  return { embeds: [embed], components: [row] };
}

export async function handlePanelInteraction(interaction) {
  try {
    // ----------------------------------------------------
    // 管理者パネル: イベント作成ボタン
    // ----------------------------------------------------
    if (interaction.isButton() && interaction.customId === 'admin_create_event') {
      const modal = new ModalBuilder()
        .setCustomId('admin_event_modal')
        .setTitle('新規イベント作成');

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('件名')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const dateInput = new TextInputBuilder()
        .setCustomId('date')
        .setLabel('日付 (例: 2026-05-01 19:00)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const locationInput = new TextInputBuilder()
        .setCustomId('location')
        .setLabel('場所')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('詳細・備考')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(dateInput),
        new ActionRowBuilder().addComponents(locationInput),
        new ActionRowBuilder().addComponents(descInput)
      );

      await interaction.showModal(modal);
      return true;
    }

    // ----------------------------------------------------
    // 管理者パネル: イベント作成モーダル送信
    // ----------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId === 'admin_event_modal') {
      await interaction.deferReply({ ephemeral: true });

      const title = interaction.fields.getTextInputValue('title');
      const date = interaction.fields.getTextInputValue('date');
      const location = interaction.fields.getTextInputValue('location');
      const desc = interaction.fields.getTextInputValue('description');

      try {
        // DBにイベント作成
        const event = await createEvent(title, date, location, desc);

        // 出欠パネルを作成してチャンネルに送信
        const panelData = buildAttendancePanel(event, []);
        const message = await interaction.channel.send(panelData);

        // メッセージIDをDBに保存
        await updateEventMessageId(event.id, message.id);

        await interaction.editReply('✅ イベントを作成し、出欠パネルを送信しました。');
      } catch (err) {
        console.error(err);
        await interaction.editReply('❌ イベント作成中にエラーが発生しました。');
      }
      return true;
    }

    // ----------------------------------------------------
    // 管理者パネル: 出欠集計ボタン / データ出力ボタン
    // ----------------------------------------------------
    if (interaction.isButton() && (interaction.customId === 'admin_tally' || interaction.customId === 'admin_export')) {
      await interaction.deferReply({ ephemeral: true });
      try {
        const events = await getActiveEvents();
        if (!events || events.length === 0) {
          await interaction.editReply('進行中のイベントがありません。');
          return true;
        }

        const options = events.map(e => ({
          label: e.title.slice(0, 100),
          description: (e.event_date || '').slice(0, 100),
          value: e.id.toString()
        }));

        const selectId = interaction.customId === 'admin_tally' ? 'admin_tally_select' : 'admin_export_select';
        
        const select = new StringSelectMenuBuilder()
          .setCustomId(selectId)
          .setPlaceholder('イベントを選択してください')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);
        await interaction.editReply({ content: '対象のイベントを選択してください：', components: [row] });
      } catch (err) {
        console.error(err);
        await interaction.editReply('❌ イベント一覧の取得に失敗しました。');
      }
      return true;
    }

    // ----------------------------------------------------
    // 管理者パネル: 集計セレクトメニュー
    // ----------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === 'admin_tally_select') {
      await interaction.deferReply({ ephemeral: true });
      const eventId = interaction.values[0];
      try {
        const { event, attendances } = await getEventWithAttendance(eventId);
        
        const attendUsers = attendances.filter(a => a.status === 'attend');
        const absentUsers = attendances.filter(a => a.status === 'absent');
        const lateUsers = attendances.filter(a => a.status === 'late');

        // ユーザーIDからメンション文字列を生成
        const mapUsers = (arr) => arr.map(a => `<@${a.user_id}>` + (a.comment ? ` (${a.comment})` : '')).join('\n') || 'なし';

        const embed = new EmbedBuilder()
          .setTitle(`📊 集計: ${event.title}`)
          .addFields(
            { name: `🟢 出席 (${attendUsers.length}名)`, value: mapUsers(attendUsers) },
            { name: `🔴 欠席 (${absentUsers.length}名)`, value: mapUsers(absentUsers) },
            { name: `🟡 遅刻/早退 (${lateUsers.length}名)`, value: mapUsers(lateUsers) }
          );

        await interaction.editReply({ embeds: [embed], components: [] });
      } catch (err) {
        console.error(err);
        await interaction.editReply('❌ 集計の取得に失敗しました。');
      }
      return true;
    }

    // ----------------------------------------------------
    // 管理者パネル: データ出力(CSV)セレクトメニュー
    // ----------------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId === 'admin_export_select') {
      await interaction.deferReply({ ephemeral: true });
      const eventId = interaction.values[0];
      try {
        const { event, attendances } = await getEventWithAttendance(eventId);
        
        const filePath = path.join(process.cwd(), `attendance_${eventId}.csv`);
        const csvWriter = createObjectCsvWriter({
          path: filePath,
          header: [
            { id: 'user_id', title: 'User ID' },
            { id: 'status', title: 'Status' },
            { id: 'comment', title: 'Comment' },
            { id: 'updated_at', title: 'Updated At' }
          ]
        });

        const records = attendances.map(a => ({
          user_id: a.user_id,
          status: a.status,
          comment: a.comment || '',
          updated_at: a.updated_at
        }));

        await csvWriter.writeRecords(records);
        
        const attachment = new AttachmentBuilder(filePath);
        await interaction.editReply({ content: `✅ 「${event.title}」の出欠データを出力しました。`, files: [attachment], components: [] });
        
        // 送信後に削除
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(err);
        await interaction.editReply('❌ CSVエクスポートに失敗しました。');
      }
      return true;
    }

    // ----------------------------------------------------
    // 出欠パネル: 出席 / 欠席 / 遅刻・早退 ボタン
    // ----------------------------------------------------
    if (interaction.isButton() && (
        interaction.customId.startsWith('attend_') || 
        interaction.customId.startsWith('absent_') || 
        interaction.customId.startsWith('late_'))) {
      
      const parts = interaction.customId.split('_');
      const action = parts[0]; // attend, absent, late
      const eventId = parts[1];

      try {
        await interaction.deferUpdate(); // ボタンのローディングを消す
        
        await upsertAttendance(eventId, interaction.user.id, action);
        
        // パネルを更新
        const { event, attendances } = await getEventWithAttendance(eventId);
        const panelData = buildAttendancePanel(event, attendances);
        
        if (interaction.message) {
          await interaction.message.edit(panelData);
        }
        
        // フィードバック
        await interaction.followUp({ content: `✅ あなたのステータスを「${action === 'attend' ? '出席' : action === 'absent' ? '欠席' : '遅刻/早退'}」として記録しました。`, ephemeral: true });
      } catch (err) {
        console.error(err);
        await interaction.followUp({ content: '❌ ステータスの更新に失敗しました。', ephemeral: true });
      }
      return true;
    }

    // ----------------------------------------------------
    // 出欠パネル: 備考入力ボタン
    // ----------------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith('comment_')) {
      const eventId = interaction.customId.split('_')[1];

      const modal = new ModalBuilder()
        .setCustomId(`comment_modal_${eventId}`)
        .setTitle('備考の入力');

      const commentInput = new TextInputBuilder()
        .setCustomId('comment')
        .setLabel('理由や備考を入力してください')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
      await interaction.showModal(modal);
      return true;
    }

    // ----------------------------------------------------
    // 出欠パネル: 備考入力モーダル送信
    // ----------------------------------------------------
    if (interaction.isModalSubmit() && interaction.customId.startsWith('comment_modal_')) {
      const eventId = interaction.customId.split('comment_modal_')[1];
      const comment = interaction.fields.getTextInputValue('comment');

      try {
        await interaction.deferUpdate();
        
        // 現在のステータスがない場合はエラーにするか、unknownで保存するか。
        // ここではとりあえずupdateCommentを呼んで、行がなければ無視またはエラー。
        // （事前にattend/absent/lateを押している前提）
        await updateComment(eventId, interaction.user.id, comment);
        
        await interaction.followUp({ content: '✅ 備考を保存しました。', ephemeral: true });
      } catch (err) {
        console.error(err);
        // 行が存在しない場合のエラーハンドリング
        await interaction.followUp({ content: '❌ 備考の保存に失敗しました。先に出席/欠席ボタンを押してください。', ephemeral: true });
      }
      return true;
    }

  } catch (error) {
    console.error('Panel Interaction Error:', error);
  }

  return false;
}
