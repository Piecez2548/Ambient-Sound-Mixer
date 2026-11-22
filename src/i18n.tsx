// Thai / English UI text. Thai is the default for Thai browsers and anyone in
// the Bangkok timezone; everyone else gets English. The choice is remembered.
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePersistentState } from './lib/storage';

export type Lang = 'th' | 'en';
export const LANGS: Lang[] = ['th', 'en'];

const en = {
  // Title bar
  'status.playing': 'Playing {n} sound{s}',
  'status.paused': 'Paused',
  'lang.switch': 'Language',

  // Mixer panel
  'mixer.title1': 'Create Your',
  'mixer.title2': 'Perfect Ambience',
  'mixer.tagline': 'Mix sounds. Match Moods. Stay In Flow.',
  'mixer.master': 'Master Volume',
  'mixer.masterAria': 'Master volume',
  'mixer.mute': 'Mute',
  'mixer.unmute': 'Unmute',
  'mixer.source': 'Source: {title}\nClick to change',
  'mixer.chooseSource': 'Choose YouTube source',
  'mixer.error': 'Error',
  'mixer.openYouTube': 'Open on YouTube',
  'mixer.volumeAria': '{name} volume',
  'mixer.remove': 'Remove {name}',
  'mixer.empty': 'Pick a template or add sounds to start your mix.',
  'mixer.add': 'Add sound',
  'mixer.share': 'Share',
  'mixer.shareTitle': 'Copy a link to this mix',
  'mixer.shareCopied': 'Link copied — anyone who opens it gets this mix',
  'mixer.sharePrompt': 'Copy this link to share your mix:',
  'mixer.limit': 'Max volume',
  'mixer.limitOn': 'Max volume limited to {n}%',
  'mixer.limitHint': 'The loudest the app can ever get, whatever the sliders say. Full sliders play at this level. Saved on this device only.',
  'mixer.natural': 'Natural variation',
  'mixer.naturalTitle': 'Let each sound’s volume rise and fall gently on its own, like real weather',
  'mixer.naturalOn': 'Natural variation on — each sound now drifts gently',
  'mixer.focus': 'Focus timer',
  'mixer.alarm': 'Alarm',
  'mixer.alarmAt': 'Alarm {time}',
  'mixer.fadingIn': 'Fading in…',
  'mixer.sleepTimer': 'Sleep timer',
  'timer.off': 'Off',
  'timer.15': '15m',
  'timer.30': '30m',
  'timer.60': '1h',
  'timer.120': '2h',
  'mixer.playAll': 'Play all',
  'mixer.pauseAll': 'Pause all',

  // Templates panel
  'tp.search': 'Search for Templates...',
  'tp.searchAria': 'Search templates',
  'tp.create': 'Create your own',
  'tp.title': 'Sound Templates',
  'tp.subtitle': 'Start with a vibe. customize it your way.',
  'tp.all': 'All',
  'tp.mine': 'Mine',
  'tp.filterAria': 'Filter by sound',
  'tp.mustInclude': 'Must include',
  'tp.clear': 'Clear',
  'tp.none': 'No templates match.',
  'tp.searchYouTube': 'Search YouTube for “{q}”',
  'card.playing': 'Playing',
  'card.paused': 'Paused',
  'card.delete': 'Delete {title}',

  // Create modal
  'create.title': 'Create your own',
  'create.subtitle': 'Add sounds from the library or YouTube, then save your mix as a template.',
  'create.library': 'Sound library',
  'create.youtube': 'Search YouTube',
  'create.save': 'Save mix',
  'yt.placeholder': 'e.g. heavy rain on tent, japanese garden…',
  'yt.long': 'Long (20 min+)',
  'yt.medium': 'Medium (4–20 min)',
  'yt.any': 'Any length',
  'yt.lengthAria': 'Video length',
  'yt.search': 'Search',
  'yt.addToMix': 'Add to mix',
  'yt.cachedHint': 'Results are cached for a week, so repeat searches are instant.',
  'yt.openAria': 'Open on YouTube',
  'save.empty': 'Your mix is empty — add some sounds first.',
  'save.name': 'Name',
  'save.namePh': 'Sunday Morning Reading',
  'save.desc': 'Description',
  'save.descPh': 'Soft rain and a crackling fire.',
  'save.moods': 'Moods',
  'save.submit': 'Save as template',
  'save.defaultDesc': '{n} sounds mixed by you.',

  // Video picker
  'picker.title': '{name} source',
  'picker.subtitle': 'Pick which YouTube video plays for this sound.',
  'picker.nowUsing': 'Now using',
  'picker.searchPh': 'Search a different video…',
  'picker.use': 'Use',

  // Misc
  'modal.close': 'Close',
  'toast.sharedLoaded': 'Shared mix loaded ({n} sounds) — press play',
  'media.sounds': '{n} sounds',

  // Errors
  'err.embed': 'This video can’t be played here',
  'err.noVideo': 'No playable video found',
  'err.network': 'Can’t reach the search server — check your internet connection',
  'err.quota': 'YouTube search limit reached for today — try again tomorrow',

  // Alarm & focus
  'rt.title': 'Alarm & Focus',
  'rt.subtitle': 'Let your ambience follow your day.',
  'rt.tabFocus': 'Focus timer',
  'rt.tabAlarm': 'Wake-up alarm',
  'rt.keepMix': 'Keep the current mix',
  'rt.min': 'min',
  'rt.focus': 'Focus',
  'rt.break': 'Break',
  'rt.done': '{n} done',
  'rt.startBreak': 'Start break',
  'rt.startFocus': 'Start focus',
  'rt.stop': 'Stop',
  'rt.focusHint': 'Work in focused blocks with short breaks. The mix switches automatically and a soft chime marks each change.',
  'rt.focusMinAria': 'Focus minutes',
  'rt.focusMixAria': 'Focus mix',
  'rt.breakMinAria': 'Break minutes',
  'rt.breakMixAria': 'Break mix',
  'rt.go': 'Start focusing',
  'rt.rings': 'Rings {when} — in {in}',
  'rt.inHM': '{h} h {m} min',
  'rt.inM': '{m} min',
  'rt.off': 'Alarm is off',
  'rt.time': 'Time',
  'rt.fadeIn': 'Fade in',
  'rt.play': 'Play',
  'rt.repeat': 'Repeat',
  'rt.daily': 'Every day',
  'rt.once': 'Once',
  'rt.turnOn': 'Turn alarm on',
  'rt.turnOff': 'Turn alarm off',
  'rt.hintApp': 'Keep the app running (the tray is fine) and the computer awake — a sleeping PC can’t ring.',
  'rt.hintWeb': 'Keep this tab open and the device awake. For a reliable alarm, use the Windows app.',
  'rt.timeAria': 'Alarm time',
  'rt.fadeAria': 'Fade-in minutes',
  'rt.mixAria': 'Alarm mix',
  'notify.morning': 'Good morning',
  'notify.morningBody': 'Your ambience is fading in.',
  'notify.break': 'Time for a break',
  'notify.breakBody': '{n} minutes — stretch, breathe, look away from the screen.',
  'notify.focus': 'Back to focus',
  'notify.focusBody': '{n} minutes.',

  // App updates (Windows app)
  'update.button': 'Update ready',
  'update.title': 'Version {v} is downloaded. Click to restart and install it — sound stops for a few seconds.',
  'update.toast': 'Update {v} is ready — click “Update ready” to restart and install it',

  // Cloud sync
  'sync.button': 'Sync',
  'sync.title': 'Sync your devices',
  'sync.subtitle': 'Keep your mix, templates and settings the same everywhere — no account needed.',
  'sync.offIntro': 'Turn sync on here to get a sync code, then enter that code (or scan the QR code) on your other devices.',
  'sync.create': 'Turn on sync',
  'sync.haveCode': 'Already have a sync code?',
  'sync.join': 'Connect',
  'sync.badCode': 'That isn’t a sync code — it has 20 letters and numbers.',
  'sync.joinNote': 'This device switches to the synced mix and settings. Templates and YouTube sounds you added here are kept and shared.',
  'sync.yourCode': 'Your sync code',
  'sync.keepSecret': 'Anyone with this code can see and change your synced data. Only enter it on your own devices.',
  'sync.copyCode': 'Copy code',
  'sync.copyLink': 'Copy link',
  'sync.copied': 'Copied',
  'sync.qrHint': 'Scan with your phone’s camera to open the app already connected.',
  'sync.whatSyncs': 'Syncs your current mix and volumes, your templates and YouTube sounds, chosen videos, focus and alarm settings, natural variation and language. Play/pause stays on each device.',
  'sync.privacy': 'Encrypted on your device before upload — the server can’t read it.',
  'sync.syncing': 'Syncing…',
  'sync.ok': 'Synced {time}',
  'sync.never': 'Not synced yet',
  'sync.now': 'Sync now',
  'sync.stop': 'Stop syncing on this device',
  'sync.delete': 'Delete cloud copy',
  'sync.deleteConfirm': 'Delete the cloud copy for this code? Each device keeps its own data but stops syncing. This can’t be undone.',
  'sync.linkTitle': 'Connect this device?',
  'sync.linkBody': 'This link connects this device to sync code {code}.',
  'sync.linkCancel': 'Not now',
  'sync.linked': 'Connected — this device is now in sync',
  'sync.started': 'Sync is on — enter the code on your other devices',
  'sync.err.notConfigured': 'Cloud sync isn’t set up on the server yet.',
  'sync.err.network': 'Offline — it will sync when you’re back online.',
  'sync.err.server': 'The sync server had a problem — it will try again.',
  'sync.err.badData': 'Couldn’t read the cloud copy. Check the sync code.',
  'sync.err.notFound': 'No synced data for this code. Check it, or turn on sync on the other device first.',
  'sync.err.deleted': 'The cloud copy was deleted on another device, so sync is now off here. Your data on this device is kept.',

  // Sounds, categories, moods
  'sound.rain': 'Rain',
  'sound.thunder': 'Thunder',
  'sound.cafe': 'Cafe',
  'sound.wind': 'Wind',
  'sound.campfire': 'Camp',
  'sound.waves': 'Waves',
  'sound.forest': 'Forest',
  'sound.tin-roof': 'Tin Roof Rain',
  'sound.stream': 'Stream',
  'sound.birds': 'Birds',
  'sound.night': 'Night',
  'sound.fireplace': 'Fireplace',
  'sound.library': 'Library',
  'sound.typing': 'Typing',
  'sound.train': 'Train',
  'sound.airplane': 'Airplane',
  'sound.city': 'City',
  'sound.fan': 'Fan',
  'sound.white-noise': 'White Noise',
  'sound.brown-noise': 'Brown Noise',
  'cat.Nature': 'Nature',
  'cat.Water': 'Water',
  'cat.Indoor': 'Indoor',
  'cat.Urban': 'Urban',
  'cat.Noise': 'Noise',
  'cat.YouTube': 'YouTube',
  'mood.Focus': 'Focus',
  'mood.Relax': 'Relax',
  'mood.Sleep': 'Sleep',
  'mood.Study': 'Study',
  'mood.Meditate': 'Meditate',

  // Templates
  'tpl.rainy-library-night.title': 'Rainy Library Night',
  'tpl.rainy-library-night.desc': 'Rain and distant thunder in a quiet library.',
  'tpl.autumn-library-evening.title': 'Autumn Library Evening',
  'tpl.autumn-library-evening.desc': 'Calm autumn winds and subtle indoor vibes.',
  'tpl.rainy-day-focus.title': 'Rainy Day Focus',
  'tpl.rainy-day-focus.desc': 'Focus-friendly daylight rain and ambience.',
  'tpl.cozy-campfire.title': 'Cozy Campfire',
  'tpl.cozy-campfire.desc': 'Crackling wood fire and a soft night breeze.',
  'tpl.cafe-chill.title': 'Cafe Chill',
  'tpl.cafe-chill.desc': 'Light chatter and gentle cafe background noise.',
  'tpl.midnight-train-ride.title': 'Midnight Train Ride',
  'tpl.midnight-train-ride.desc': 'A peaceful train journey through a rainy night.',
  'tpl.ocean-meditation.title': 'Ocean Meditation',
  'tpl.ocean-meditation.desc': 'Slow waves rolling onto a calm, breezy shore.',
  'tpl.forest-morning.title': 'Forest Morning',
  'tpl.forest-morning.desc': 'Birdsong and a trickling stream at sunrise.',
};

export type Key = keyof typeof en;

const th: Record<Key, string> = {
  'status.playing': 'กำลังเล่น {n} เสียง',
  'status.paused': 'หยุดชั่วคราว',
  'lang.switch': 'ภาษา',

  'mixer.title1': 'สร้างบรรยากาศ',
  'mixer.title2': 'ในแบบของคุณ',
  'mixer.tagline': 'ผสมเสียง เลือกอารมณ์ แล้วจดจ่อกับสิ่งที่ทำ',
  'mixer.master': 'ระดับเสียงรวม',
  'mixer.masterAria': 'ระดับเสียงรวม',
  'mixer.mute': 'ปิดเสียง',
  'mixer.unmute': 'เปิดเสียง',
  'mixer.source': 'วิดีโอ: {title}\nคลิกเพื่อเปลี่ยน',
  'mixer.chooseSource': 'เลือกวิดีโอจาก YouTube',
  'mixer.error': 'ผิดพลาด',
  'mixer.openYouTube': 'เปิดใน YouTube',
  'mixer.volumeAria': 'ระดับเสียง{name}',
  'mixer.remove': 'เอา{name}ออก',
  'mixer.empty': 'เลือกเทมเพลตหรือเพิ่มเสียงเพื่อเริ่มมิกซ์',
  'mixer.add': 'เพิ่มเสียง',
  'mixer.share': 'แชร์',
  'mixer.shareTitle': 'คัดลอกลิงก์ของมิกซ์นี้',
  'mixer.shareCopied': 'คัดลอกลิงก์แล้ว ใครเปิดก็ได้มิกซ์นี้',
  'mixer.sharePrompt': 'คัดลอกลิงก์นี้เพื่อแชร์มิกซ์ของคุณ:',
  'mixer.limit': 'เสียงดังสุด',
  'mixer.limitOn': 'จำกัดเสียงดังสุดที่ {n}%',
  'mixer.limitHint': 'ระดับเสียงสูงสุดที่แอปจะดังได้ ไม่ว่าจะลากแถบไปที่ไหน ถ้าลากสุดจะได้เท่าระดับนี้ บันทึกไว้ในเครื่องนี้เท่านั้น',
  'mixer.natural': 'เสียงเป็นธรรมชาติ',
  'mixer.naturalTitle': 'ให้ระดับเสียงแต่ละตัวขึ้นลงเบาๆ เอง เหมือนอากาศจริง',
  'mixer.naturalOn': 'เปิดเสียงเป็นธรรมชาติแล้ว แต่ละเสียงจะขึ้นลงเบาๆ เอง',
  'mixer.focus': 'จับเวลาโฟกัส',
  'mixer.alarm': 'นาฬิกาปลุก',
  'mixer.alarmAt': 'ปลุก {time}',
  'mixer.fadingIn': 'กำลังค่อยๆ ดังขึ้น…',
  'mixer.sleepTimer': 'ตั้งเวลาปิด',
  'timer.off': 'ปิด',
  'timer.15': '15 น.',
  'timer.30': '30 น.',
  'timer.60': '1 ชม.',
  'timer.120': '2 ชม.',
  'mixer.playAll': 'เล่นทั้งหมด',
  'mixer.pauseAll': 'หยุดทั้งหมด',

  'tp.search': 'ค้นหาเทมเพลต...',
  'tp.searchAria': 'ค้นหาเทมเพลต',
  'tp.create': 'สร้างเอง',
  'tp.title': 'เทมเพลตเสียง',
  'tp.subtitle': 'เริ่มจากบรรยากาศที่ชอบ แล้วปรับให้เป็นแบบของคุณ',
  'tp.all': 'ทั้งหมด',
  'tp.mine': 'ของฉัน',
  'tp.filterAria': 'กรองตามเสียง',
  'tp.mustInclude': 'ต้องมีเสียง',
  'tp.clear': 'ล้าง',
  'tp.none': 'ไม่พบเทมเพลตที่ตรงกัน',
  'tp.searchYouTube': 'ค้นหา “{q}” ใน YouTube',
  'card.playing': 'กำลังเล่น',
  'card.paused': 'หยุดชั่วคราว',
  'card.delete': 'ลบ {title}',

  'create.title': 'สร้างเอง',
  'create.subtitle': 'เพิ่มเสียงจากคลังหรือจาก YouTube แล้วบันทึกมิกซ์เป็นเทมเพลตของคุณ',
  'create.library': 'คลังเสียง',
  'create.youtube': 'ค้นหาใน YouTube',
  'create.save': 'บันทึกมิกซ์',
  'yt.placeholder': 'เช่น ฝนตกบนเต็นท์, สวนญี่ปุ่น…',
  'yt.long': 'ยาว (20 นาทีขึ้นไป)',
  'yt.medium': 'กลาง (4–20 นาที)',
  'yt.any': 'ทุกความยาว',
  'yt.lengthAria': 'ความยาววิดีโอ',
  'yt.search': 'ค้นหา',
  'yt.addToMix': 'เพิ่มในมิกซ์',
  'yt.cachedHint': 'ผลการค้นหาเก็บไว้ 1 สัปดาห์ ค้นคำเดิมซ้ำจะได้ผลทันที',
  'yt.openAria': 'เปิดใน YouTube',
  'save.empty': 'มิกซ์ยังว่างอยู่ เพิ่มเสียงก่อนนะ',
  'save.name': 'ชื่อ',
  'save.namePh': 'อ่านหนังสือเช้าวันอาทิตย์',
  'save.desc': 'คำอธิบาย',
  'save.descPh': 'ฝนตกเบาๆ กับเสียงไฟในเตาผิง',
  'save.moods': 'อารมณ์',
  'save.submit': 'บันทึกเป็นเทมเพลต',
  'save.defaultDesc': 'มิกซ์ {n} เสียงของคุณเอง',

  'picker.title': 'วิดีโอของเสียง{name}',
  'picker.subtitle': 'เลือกวิดีโอ YouTube ที่จะใช้เล่นเสียงนี้',
  'picker.nowUsing': 'ใช้อยู่ตอนนี้',
  'picker.searchPh': 'ค้นหาวิดีโออื่น…',
  'picker.use': 'ใช้',

  'modal.close': 'ปิด',
  'toast.sharedLoaded': 'โหลดมิกซ์ที่แชร์มาแล้ว ({n} เสียง) กดเล่นได้เลย',
  'media.sounds': '{n} เสียง',

  'err.embed': 'วิดีโอนี้เล่นในแอปไม่ได้',
  'err.noVideo': 'ไม่พบวิดีโอที่เล่นได้',
  'err.network': 'เชื่อมต่อเซิร์ฟเวอร์ค้นหาไม่ได้ ตรวจสอบอินเทอร์เน็ต',
  'err.quota': 'วันนี้ค้นหา YouTube ครบโควตาแล้ว ลองใหม่พรุ่งนี้',

  'rt.title': 'นาฬิกาปลุกและโฟกัส',
  'rt.subtitle': 'ให้เสียงบรรยากาศเปลี่ยนไปตามวันของคุณ',
  'rt.tabFocus': 'จับเวลาโฟกัส',
  'rt.tabAlarm': 'นาฬิกาปลุก',
  'rt.keepMix': 'ใช้มิกซ์ปัจจุบัน',
  'rt.min': 'นาที',
  'rt.focus': 'โฟกัส',
  'rt.break': 'พัก',
  'rt.done': 'เสร็จแล้ว {n} รอบ',
  'rt.startBreak': 'เริ่มพัก',
  'rt.startFocus': 'เริ่มโฟกัส',
  'rt.stop': 'หยุด',
  'rt.focusHint': 'ทำงานเป็นช่วงๆ สลับกับพักสั้นๆ มิกซ์จะเปลี่ยนเองและมีเสียงกริ๊งเบาๆ ทุกครั้งที่เปลี่ยนช่วง',
  'rt.focusMinAria': 'นาทีโฟกัส',
  'rt.focusMixAria': 'มิกซ์ตอนโฟกัส',
  'rt.breakMinAria': 'นาทีพัก',
  'rt.breakMixAria': 'มิกซ์ตอนพัก',
  'rt.go': 'เริ่มโฟกัส',
  'rt.rings': 'ปลุก{when} — อีก {in}',
  'rt.inHM': '{h} ชม. {m} นาที',
  'rt.inM': '{m} นาที',
  'rt.off': 'ปิดนาฬิกาปลุกอยู่',
  'rt.time': 'เวลา',
  'rt.fadeIn': 'ค่อยๆ ดังขึ้น',
  'rt.play': 'เล่น',
  'rt.repeat': 'ทำซ้ำ',
  'rt.daily': 'ทุกวัน',
  'rt.once': 'ครั้งเดียว',
  'rt.turnOn': 'เปิดนาฬิกาปลุก',
  'rt.turnOff': 'ปิดนาฬิกาปลุก',
  'rt.hintApp': 'เปิดแอปทิ้งไว้ (ย่อลง tray ได้) และอย่าให้คอมพิวเตอร์หลับ คอมที่หลับอยู่ปลุกไม่ได้',
  'rt.hintWeb': 'เปิดแท็บนี้ทิ้งไว้และอย่าให้เครื่องหลับ ถ้าอยากได้นาฬิกาปลุกที่ชัวร์ ใช้แอปบน Windows',
  'rt.timeAria': 'เวลาปลุก',
  'rt.fadeAria': 'นาทีที่ค่อยๆ ดังขึ้น',
  'rt.mixAria': 'มิกซ์ตอนปลุก',
  'notify.morning': 'อรุณสวัสดิ์',
  'notify.morningBody': 'เสียงบรรยากาศกำลังค่อยๆ ดังขึ้น',
  'notify.break': 'ได้เวลาพักแล้ว',
  'notify.breakBody': '{n} นาที ยืดเส้นยืดสาย หายใจลึกๆ พักสายตาจากจอ',
  'notify.focus': 'กลับมาโฟกัส',
  'notify.focusBody': '{n} นาที',

  'update.button': 'อัปเดตพร้อมแล้ว',
  'update.title': 'ดาวน์โหลดเวอร์ชัน {v} เสร็จแล้ว กดเพื่อรีสตาร์ทและติดตั้ง เสียงจะหยุดไปไม่กี่วินาที',
  'update.toast': 'เวอร์ชัน {v} พร้อมแล้ว กด “อัปเดตพร้อมแล้ว” เพื่อรีสตาร์ทและติดตั้ง',

  'sync.button': 'ซิงก์',
  'sync.title': 'ซิงก์ข้ามเครื่อง',
  'sync.subtitle': 'ให้มิกซ์ เทมเพลต และการตั้งค่าเหมือนกันทุกเครื่อง ไม่ต้องสมัครบัญชี',
  'sync.offIntro': 'เปิดซิงก์ที่เครื่องนี้เพื่อรับรหัสซิงก์ แล้วใส่รหัสนั้น (หรือสแกน QR) ในเครื่องอื่นของคุณ',
  'sync.create': 'เปิดซิงก์',
  'sync.haveCode': 'มีรหัสซิงก์อยู่แล้ว?',
  'sync.join': 'เชื่อมต่อ',
  'sync.badCode': 'รหัสไม่ถูกต้อง รหัสซิงก์มีตัวอักษรและตัวเลข 20 ตัว',
  'sync.joinNote': 'เครื่องนี้จะเปลี่ยนไปใช้มิกซ์และการตั้งค่าที่ซิงก์ไว้ ส่วนเทมเพลตและเสียงจาก YouTube ที่เพิ่มไว้ในเครื่องนี้จะยังอยู่และแชร์ไปทุกเครื่อง',
  'sync.yourCode': 'รหัสซิงก์ของคุณ',
  'sync.keepSecret': 'ใครมีรหัสนี้จะเห็นและแก้ข้อมูลที่ซิงก์ได้ ใส่เฉพาะในเครื่องของคุณเองเท่านั้น',
  'sync.copyCode': 'คัดลอกรหัส',
  'sync.copyLink': 'คัดลอกลิงก์',
  'sync.copied': 'คัดลอกแล้ว',
  'sync.qrHint': 'สแกนด้วยกล้องมือถือ เพื่อเปิดแอปที่เชื่อมต่อไว้แล้ว',
  'sync.whatSyncs': 'ซิงก์มิกซ์ที่กำลังใช้และระดับเสียง เทมเพลตและเสียงจาก YouTube ที่คุณเพิ่ม วิดีโอที่เลือก การตั้งค่าโฟกัสและนาฬิกาปลุก เสียงเป็นธรรมชาติ และภาษา ส่วนการกดเล่น/หยุดแยกกันแต่ละเครื่อง',
  'sync.privacy': 'ข้อมูลถูกเข้ารหัสในเครื่องก่อนอัปโหลด เซิร์ฟเวอร์อ่านไม่ได้',
  'sync.syncing': 'กำลังซิงก์…',
  'sync.ok': 'ซิงก์ล่าสุด {time}',
  'sync.never': 'ยังไม่ได้ซิงก์',
  'sync.now': 'ซิงก์ตอนนี้',
  'sync.stop': 'หยุดซิงก์ในเครื่องนี้',
  'sync.delete': 'ลบข้อมูลบนคลาวด์',
  'sync.deleteConfirm': 'ลบข้อมูลบนคลาวด์ของรหัสนี้? แต่ละเครื่องยังเก็บข้อมูลของตัวเองไว้ แต่จะหยุดซิงก์ และย้อนกลับไม่ได้',
  'sync.linkTitle': 'เชื่อมต่อเครื่องนี้?',
  'sync.linkBody': 'ลิงก์นี้จะเชื่อมเครื่องนี้เข้ากับรหัสซิงก์ {code}',
  'sync.linkCancel': 'ไว้ทีหลัง',
  'sync.linked': 'เชื่อมต่อแล้ว เครื่องนี้ซิงก์อยู่',
  'sync.started': 'เปิดซิงก์แล้ว ใส่รหัสนี้ในเครื่องอื่นของคุณ',
  'sync.err.notConfigured': 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าที่เก็บข้อมูลคลาวด์',
  'sync.err.network': 'ออฟไลน์อยู่ จะซิงก์เมื่อกลับมาออนไลน์',
  'sync.err.server': 'เซิร์ฟเวอร์ซิงก์มีปัญหา จะลองใหม่อัตโนมัติ',
  'sync.err.badData': 'อ่านข้อมูลบนคลาวด์ไม่ได้ ตรวจสอบรหัสซิงก์อีกครั้ง',
  'sync.err.notFound': 'ไม่พบข้อมูลของรหัสนี้ ตรวจสอบรหัส หรือเปิดซิงก์ที่อีกเครื่องก่อน',
  'sync.err.deleted': 'ข้อมูลบนคลาวด์ถูกลบจากอีกเครื่อง เครื่องนี้จึงหยุดซิงก์แล้ว ข้อมูลในเครื่องยังอยู่ครบ',

  'sound.rain': 'ฝน',
  'sound.thunder': 'ฟ้าร้อง',
  'sound.cafe': 'คาเฟ่',
  'sound.wind': 'ลม',
  'sound.campfire': 'แคมป์ไฟ',
  'sound.waves': 'คลื่น',
  'sound.forest': 'ป่า',
  'sound.tin-roof': 'ฝนบนหลังคา',
  'sound.stream': 'ลำธาร',
  'sound.birds': 'นก',
  'sound.night': 'กลางคืน',
  'sound.fireplace': 'เตาผิง',
  'sound.library': 'ห้องสมุด',
  'sound.typing': 'เสียงพิมพ์',
  'sound.train': 'รถไฟ',
  'sound.airplane': 'เครื่องบิน',
  'sound.city': 'เมือง',
  'sound.fan': 'พัดลม',
  'sound.white-noise': 'ไวท์นอยส์',
  'sound.brown-noise': 'บราวน์นอยส์',
  'cat.Nature': 'ธรรมชาติ',
  'cat.Water': 'น้ำ',
  'cat.Indoor': 'ในบ้าน',
  'cat.Urban': 'ในเมือง',
  'cat.Noise': 'นอยส์',
  'cat.YouTube': 'YouTube',
  'mood.Focus': 'โฟกัส',
  'mood.Relax': 'ผ่อนคลาย',
  'mood.Sleep': 'นอนหลับ',
  'mood.Study': 'อ่านหนังสือ',
  'mood.Meditate': 'สมาธิ',

  'tpl.rainy-library-night.title': 'ค่ำคืนฝนพรำในห้องสมุด',
  'tpl.rainy-library-night.desc': 'เสียงฝนกับฟ้าร้องไกลๆ ในห้องสมุดที่เงียบสงบ',
  'tpl.autumn-library-evening.title': 'ห้องสมุดยามเย็นฤดูใบไม้ร่วง',
  'tpl.autumn-library-evening.desc': 'ลมฤดูใบไม้ร่วงแผ่วเบากับบรรยากาศอบอุ่นในห้อง',
  'tpl.rainy-day-focus.title': 'โฟกัสวันฝนตก',
  'tpl.rainy-day-focus.desc': 'ฝนตกยามกลางวันกับบรรยากาศที่ช่วยให้มีสมาธิ',
  'tpl.cozy-campfire.title': 'แคมป์ไฟอบอุ่น',
  'tpl.cozy-campfire.desc': 'เสียงไฟปะทุเปาะแปะกับลมกลางคืนเบาๆ',
  'tpl.cafe-chill.title': 'คาเฟ่ชิลๆ',
  'tpl.cafe-chill.desc': 'เสียงพูดคุยเบาๆ กับบรรยากาศในร้านกาแฟ',
  'tpl.midnight-train-ride.title': 'นั่งรถไฟตอนเที่ยงคืน',
  'tpl.midnight-train-ride.desc': 'การเดินทางด้วยรถไฟอันสงบท่ามกลางคืนฝนตก',
  'tpl.ocean-meditation.title': 'สมาธิริมทะเล',
  'tpl.ocean-meditation.desc': 'คลื่นซัดฝั่งช้าๆ บนชายหาดที่ลมพัดเย็นสบาย',
  'tpl.forest-morning.title': 'เช้าในป่า',
  'tpl.forest-morning.desc': 'เสียงนกร้องกับลำธารไหลรินยามรุ่งอรุณ',
};

const DICTS: Record<Lang, Record<string, string>> = { en, th };

export function detectLang(): Lang {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    if (langs.some((l) => l?.toLowerCase().startsWith('th'))) return 'th';
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Bangkok') return 'th';
  } catch {
    /* ignore */
  }
  return 'en';
}

export type Vars = Record<string, string | number>;
export type T = (key: Key, vars?: Vars) => string;

function format(text: string, vars?: Vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Translate a key that may not exist (data-driven: sound ids, template ids…). */
function lookup(lang: Lang, key: string) {
  return DICTS[lang][key] ?? DICTS.en[key];
}

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
  /** Optional translation: returns `fallback` when there's no entry for `key`. */
  tx: (key: string, fallback: string) => string;
  /** Turn an error code from the mixer/search into a sentence. */
  errorText: (code: string | undefined) => string;
  locale: string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = usePersistentState<Lang>('asm:lang', detectLang());
  const safe: Lang = LANGS.includes(lang) ? lang : 'en';

  useEffect(() => {
    document.documentElement.lang = safe;
    (window as any).ambient?.setLanguage?.(safe);
  }, [safe]);

  const t = useCallback<T>((key, vars) => format(lookup(safe, key) ?? key, vars), [safe]);
  const tx = useCallback((key: string, fallback: string) => lookup(safe, key) ?? fallback, [safe]);
  const errorText = useCallback(
    (code: string | undefined) => {
      if (!code) return '';
      const map: Record<string, Key> = {
        embed: 'err.embed',
        noVideo: 'err.noVideo',
        network: 'err.network',
        quotaExceeded: 'err.quota',
        rateLimitExceeded: 'err.quota',
        dailyLimitExceeded: 'err.quota',
      };
      return map[code] ? t(map[code]) : code;
    },
    [t],
  );

  const value = useMemo(
    () => ({ lang: safe, setLang, t, tx, errorText, locale: safe === 'th' ? 'th-TH' : 'en-US' }),
    [safe, setLang, t, tx, errorText],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}

// Data helpers ----------------------------------------------------------------
interface Named {
  id: string;
  name: string;
  category?: string;
}
export const soundName = (i: Pick<I18n, 'tx'>, s: Named) => i.tx(`sound.${s.id}`, s.name);
export const categoryName = (i: Pick<I18n, 'tx'>, c: string) => i.tx(`cat.${c}`, c);
export const moodName = (i: Pick<I18n, 'tx'>, m: string) => i.tx(`mood.${m}`, m);
export const templateTitle = (i: Pick<I18n, 'tx'>, t: { id: string; title: string }) => i.tx(`tpl.${t.id}.title`, t.title);
export const templateDesc = (i: Pick<I18n, 'tx'>, t: { id: string; description: string }) => i.tx(`tpl.${t.id}.desc`, t.description);
