"use strict";

// Prompt builders for the spatial AI assistant. Responses come back in the
// user's chosen language; the system prompt forbids reasoning leakage so quick
// (non-thinking) tasks return just the answer.

const LANGUAGE_NAMES = {
  tr: "Türkçe",
  en: "English",
  ko: "한국어",
  ja: "日本語",
};

function languageName(lang) {
  return LANGUAGE_NAMES[lang] || LANGUAGE_NAMES.en;
}

function systemPrompt(lang, catName, persona) {
  const name = (catName && String(catName).trim()) || "Kiri";
  const langName = languageName(lang);
  const personaLine = persona && String(persona).trim()
    ? `Kişiliğin: ${String(persona).trim()}`
    : "";
  return [
    `Sen ${name}, kullanıcının masaüstünde yaşayan yardımsever bir kedi-AI asistanısın.`,
    personaLine,
    `Kullanıcı seni ekrandaki bir içeriğin üzerine bıraktı; sana o bölgenin ekran görüntüsü verildi.`,
    `Görüntüyü incele ve istenen görevi yap.`,
    ``,
    `Kurallar:`,
    `- Yanıtı her zaman ${langName} dilinde ver.`,
    `- Kısa ve net ol. "İşte", "Tabii", "Elbette" gibi giriş cümleleri kullanma.`,
    `- Düşünme/çözümleme sürecini yazma; yalnızca nihai sonucu ver.`,
    `- Görüntüde ilgili içerik yoksa bunu tek cümlede belirt.`,
    `- Emin olmadığın yerde tahmin yürüttüğünü kısaca söyle.`,
  ].join("\n");
}

// Quick classification pass → recommends a task and gives a one-line preview.
function classifyUserText(lang) {
  const langName = languageName(lang);
  return [
    `Bu ekran görüntüsünün altında ne olduğunu sınıflandır ve en uygun görevi öner.`,
    `Yalnızca aşağıdaki şemaya uyan GEÇERLİ JSON döndür, başka hiçbir şey yazma:`,
    `{`,
    `  "contentType": "text|question|code|table|image|error|ui|empty|other",`,
    `  "brief": "${langName} dilinde, en fazla 12 kelimelik tek cümlelik özet",`,
    `  "recommendedTask": "summarize|solve|explain|translate|extract"`,
    `}`,
    `Soru/test görürsen recommendedTask = "solve". Uzun metin/makale görürsen "summarize".`,
    `Kod/hata/kavram görürsen "explain". Yabancı dilde metin görürsen "translate".`,
  ].join("\n");
}

// User text for a concrete task call.
function taskUserText(task, lang, instructionOverride) {
  const langName = languageName(lang);
  let instruction = instructionOverride || task.instruction || "";
  if (task.id === "translate") {
    instruction = `Görüntüdeki metni ${langName} diline çevir. Sadece çeviriyi ver, ek açıklama yazma.`;
  }
  return `${instruction}\n\nYanıtı ${langName} dilinde ver.`;
}

// System prompt for the "ask about my whole screen" flow (push-to-talk / typed
// question). The full screen is the context, but the cat's position is a strong
// hint: users usually ask about whatever the cat is sitting next to. The model
// may point at a UI element with [POINT:x,y] (normalized 0..1 of the screen).
function screenQuestionSystem(lang, catName, persona, cat) {
  const name = (catName && String(catName).trim()) || "Kiri";
  const langName = languageName(lang);
  const personaLine = persona && String(persona).trim()
    ? `Kişiliğin: ${String(persona).trim()}`
    : "";
  const cx = cat && Number.isFinite(cat.x) ? Math.round(cat.x * 100) : 50;
  const cy = cat && Number.isFinite(cat.y) ? Math.round(cat.y * 100) : 50;
  return [
    `Sen ${name}, kullanıcının masaüstünde yaşayan yardımsever bir kedi-AI asistanısın.`,
    personaLine,
    `Sana kullanıcının EKRANININ TAMAMININ görüntüsü ve sözlü/yazılı bir sorusu verildi.`,
    ``,
    `ÖNEMLİ — kullanıcının ne kastettiği:`,
    `- Sen ekranda yaklaşık (%${cx}, %${cy}) konumunda (soldan/yukarıdan) duruyorsun.`,
    `- Kullanıcı çoğu zaman SENİN BULUNDUĞUN YERE yakın olan içeriği kastediyor —`,
    `  seni oraya taşıyıp o şeyi sorar. Soru belirsizse, önceliği senin çevrendeki`,
    `  (o konuma yakın) pencere/metin/öğeye ver; tüm ekranı eşit varsayma.`,
    `- Soru açıkça ekranın başka bir yerini işaret ediyorsa (ör. "sağ üstteki…") ona uy.`,
    ``,
    `Kurallar:`,
    `- Yanıtı her zaman ${langName} dilinde ver. Kısa ve net ol; giriş cümlesi kullanma.`,
    `- Düşünme sürecini yazma; yalnızca sonucu ver.`,
    `- Kullanıcıyı ekranda BELİRLİ bir öğeye yönlendiriyorsan, o öğenin merkezini`,
    `  yanıtının SONUNA ayrı bir satırda şu formatta ekle: [POINT:x,y]`,
    `  x ve y, ekran genişliği/yüksekliğine göre 0 ile 1 arası ondalık olsun`,
    `  (ör. sol-üst [POINT:0.12,0.08]). Yalnızca gerçekten bir yeri gösteriyorsan ekle.`,
  ].filter(Boolean).join("\n");
}

function screenQuestionUser(question, lang) {
  const langName = languageName(lang);
  const q = String(question || "").trim() || "Ekranımda ne var, ne yapmalıyım?";
  return `Soru: ${q}\n\nYanıtı ${langName} dilinde ver.`;
}

// System prompt for the action/command agent (text-driven, may use tools).
function agentSystemPrompt(lang, catName, persona) {
  const name = (catName && String(catName).trim()) || "Kiri";
  const langName = languageName(lang);
  const personaLine = persona && String(persona).trim()
    ? `Kişiliğin: ${String(persona).trim()}`
    : "";
  return [
    `Sen ${name}, kullanıcının masaüstünde yaşayan yardımsever bir AI asistanısın.`,
    personaLine,
    `Kullanıcının komutunu yerine getirmek için sana verilen ARAÇLARDAN uygun olanı çağır.`,
    `Bir dosya/sunum/belge isteniyorsa içeriği (slayt başlıkları, maddeler, paragraflar) SEN üret — zengin, doğru ve isteğe uygun olsun.`,
    ``,
    `Kurallar:`,
    `- Aksiyon gerektiren istekte mutlaka bir araç çağır; sadece metinle geçiştirme.`,
    `- Araç gerektirmeyen (sohbet/soru) bir istekse düz metinle, ${langName} dilinde yanıtla.`,
    `- Dosya adları kısa ve sade olsun.`,
    `- Tüm metinsel içerik ${langName} dilinde olsun.`,
  ].filter(Boolean).join("\n");
}

// Turn a natural-language description into a reusable skill definition (JSON).
function skillAuthorSystem(lang) {
  const langName = languageName(lang);
  return [
    `Kullanıcı, daha sonra komutla tekrar çalıştıracağı bir otomasyon (skill) tarif ediyor.`,
    `Bunu yeniden kullanılabilir bir skill tanımına çevir.`,
    `Kullanılabilir araçlar: create_pptx (sunum), create_docx (Word), write_file (md/txt/html).`,
    `Yalnızca aşağıdaki şemaya uyan GEÇERLİ JSON döndür, başka hiçbir şey yazma:`,
    `{`,
    `  "name": "kısa skill adı (${langName})",`,
    `  "emoji": "tek emoji",`,
    `  "triggers": ["komutu tetikleyecek 2-4 kısa ifade"],`,
    `  "instruction": "skill çalışınca modelin izleyeceği talimat (${langName})",`,
    `  "tools": ["create_pptx|create_docx|write_file arasından kullanılacaklar"]`,
    `}`,
  ].join("\n");
}

function skillAuthorUser(description, lang) {
  const langName = languageName(lang);
  return `Tarif: ${description}\n\nYukarıdaki şemaya uygun skill JSON'unu ${langName} ile üret.`;
}

module.exports = {
  LANGUAGE_NAMES,
  languageName,
  systemPrompt,
  classifyUserText,
  taskUserText,
  screenQuestionSystem,
  screenQuestionUser,
  agentSystemPrompt,
  skillAuthorSystem,
  skillAuthorUser,
};
