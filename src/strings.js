// Bilingual (English / Arabic) reply strings.
export function detectLang(text = '') {
  return /[؀-ۿ]/.test(text) ? 'ar' : 'en';
}

const HELP_EN = `🤖 *ChatToDO* — your WhatsApp to-do & reminder bot

Talk to me by *text* or *voice note*, in English or Arabic. I understand:

*Add / remind*
  • _remind me to call mom tomorrow at 6pm_
  • _gym today at 7pm_
  • _buy milk_  (no time = just saved to your list)

*Ask what's on your list*
  • _what do I have today?_
  • _what's on this week?_
  • _list_  (everything)

*Update*
  • _done 3_   (finish task #3)
  • _delete 3_ (remove task #3)

I'll message you exactly when a reminder is due. ⏰`;

const HELP_AR = `🤖 *ChatToDO* — مساعد المهام والتذكيرات بتاعك على واتساب

كلمني *نص* أو *رسالة صوتية*، بالعربي أو الإنجليزي. أنا بفهم:

*تسجيل / تذكير*
  • _ذكرني اكلم ماما بكرة الساعة 6_
  • _الجيم النهاردة الساعة 7_
  • _اشتري لبن_  (من غير وقت = بتتسجل في الليستة)

*تسأل عندك ايه*
  • _النهاردة عندي ايه؟_
  • _الأسبوع ده عندي ايه؟_
  • _المهام_  (كل حاجة)

*تعديل*
  • _تم 3_   (خلصت المهمة رقم 3)
  • _احذف 3_ (امسح المهمة رقم 3)

هبعتلك رسالة بالظبط لما ييجي وقت التذكير. ⏰`;

export function t(lang) {
  const ar = lang === 'ar';
  return {
    lang,
    help: ar ? HELP_AR : HELP_EN,
    titleToday: ar ? '🗓️ *النهاردة*' : '🗓️ *Today*',
    titleWeek: ar ? '🗓️ *الأسبوع*' : '🗓️ *This week*',
    titleAll: ar ? '📋 *كل المهام*' : '📋 *All open tasks*',
    notFound: (id) => (ar ? `ملقيتش المهمة رقم #${id}.` : `I couldn't find task #${id}.`),
    alreadyDone: (id) => (ar ? `المهمة #${id} خلصانة خلاص ✅` : `Task #${id} is already done. ✅`),
    doneOk: (txt) => (ar ? `✅ تمام: *${txt}*\nبرافو!` : `✅ Done: *${txt}*\nNice work!`),
    deleted: (txt) => (ar ? `🗑️ اتمسحت: *${txt}*` : `🗑️ Deleted: *${txt}*`),
    addReminder: (txt, when, id) =>
      ar
        ? `⏰ تمام، هفكّرك:\n*${txt}*\n_${when}_\n\n(مهمة #${id})`
        : `⏰ Got it. I'll remind you:\n*${txt}*\n_${when}_\n\n(task #${id})`,
    addNoTime: (taskLine) =>
      ar
        ? `📝 ضفتها لليستة:\n${taskLine}\n\n_من غير وقت — قول "ذكرني ... بكرة الساعة 5" لو عايز تنبيه._`
        : `📝 Added to your list:\n${taskLine}\n\n_No time set — say "remind me ... tomorrow 5pm" if you want a ping._`,
    addEmpty: ar
      ? 'مش فاهم اسجّل ايه. جرّب: _ذكرني اكلم ماما بكرة الساعة 6_'
      : "I didn't catch what to remember. Try: _remind me to call mom tomorrow 6pm_",
    unknown: ar
      ? 'مش متأكد قصدك ايه. ابعت *مساعدة* عشان تشوف اقدر اعمل ايه.'
      : "I'm not sure what you mean. Send *help* to see what I can do.",
    reminder: (txt, when, id) =>
      ar
        ? `⏰ *تذكير:* ${txt}\n_(${when})_\n\nرد *تم ${id}* لما تخلّص.`
        : `⏰ *Reminder:* ${txt}\n_(${when})_\n\nReply *done ${id}* when finished.`,
    heard: (txt) => (ar ? `🎤 _سمعت:_ "${txt}"\n\n` : `🎤 _Heard:_ "${txt}"\n\n`),
    didntCatch: ar ? 'مسمعتش حاجة. ابعت *مساعدة*.' : "I didn't catch that. Send *help* to see what I can do.",
    voiceOff: ar
      ? '🎤 وصلتني رسالة صوتية بس تحويل الصوت لنص مقفول. ابعت نص، أو فعّل الصوت بمفتاح GROQ_API_KEY المجاني.'
      : '🎤 I got your voice note, but voice transcription is off. Send text, or set GROQ_API_KEY (free) to enable voice.',
    voiceErr: ar
      ? '🎤 معلش، مفهمتش الرسالة الصوتية. ممكن تبعتها نص؟'
      : "🎤 Sorry, I couldn't understand that voice note. Could you send it as text?",
  };
}
