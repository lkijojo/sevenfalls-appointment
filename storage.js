/**
 * js/storage.js - 本地优先 + Firebase 实时同步版
 * 策略：
 *   保存 → 先存 localStorage（瞬间）→ 后台上传 Firebase
 *   加载 → 先读 localStorage（瞬间）→ Firebase 来了自动更新
 *   监听 → onSnapshot 实时推送，任何设备改动所有设备自动刷新
 */

const firebaseConfig = {
    apiKey: "AIzaSyDLIrQVbeLXONbdVPYsQC7sy4PuBLBcdHE",
    authDomain: "seven-falls-spa.firebaseapp.com",
    projectId: "seven-falls-spa",
    storageBucket: "seven-falls-spa.firebasestorage.app",
    messagingSenderId: "144342293276",
    appId: "1:144342293276:web:cc0b6140be8828609af8d9"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 当前正在监听的日期，避免重复注册
let _currentListeningDate = null;
let _unsubscribe = null;

// 🚀 数据翻新工具（统一处理旧数据兼容）
function upgradeAppts(rawAppts) {
    return rawAppts.map(appt => ({
        ...appt,
        id: appt.id ? String(appt.id) : (Date.now() + Math.random()).toString(),
        roomStart: appt.roomStart || appt.start,
        roomEnd: appt.roomEnd || appt.end,
        savedStaff1: appt.savedStaff1 || (Array.isArray(appt.staff) ? "AUTO" : appt.staff),
        savedStaff2: appt.savedStaff2 || "AUTO",
        projectSnapshot: appt.projectSnapshot || []
    }));
}

// 标志位：自己刚保存时设为 true，避免触发自己的监听刷新
let _justSaved = false;

const Storage = {

    // =====================================================
    // 💾 保存：先本地，后台上传云端
    // =====================================================
    save: async (date, appts, scores, att) => {
        // 1. 先立刻存本地（瞬间完成，UI 不卡）
        localStorage.setItem(`harmony_appts_${date}`, JSON.stringify(appts));
        localStorage.setItem(`harmony_scores_${date}`, JSON.stringify(scores));
        localStorage.setItem(`harmony_attendance_${date}`, JSON.stringify(att));

        // 2. 标记"自己刚保存"，防止 onSnapshot 触发自己刷新
        _justSaved = true;
        setTimeout(() => { _justSaved = false; }, 3000);

        // 3. 后台上传 Firebase（不 await，不阻塞）
const shifts = localStorage.getItem(`harmony_shifts_${date}`) || '{}'; // ✨ 获取本地班次

db.collection("spa_data").doc(date).set({
    appts: JSON.stringify(appts),
    scores: JSON.stringify(scores),
    att: JSON.stringify(att),
    shifts: shifts, // 🚀 班次也传到云端
    updatedAt: new Date().toISOString()
}).catch(e => {
            console.error("🔥 云端同步失败:", e);
        });
    },

    // =====================================================
    // 📖 加载：先读本地，同时注册云端实时监听
    // =====================================================
    load: async (date) => {
        // 1. 先从本地读（瞬间显示，不卡）
        const localAppts  = JSON.parse(localStorage.getItem(`harmony_appts_${date}`) || '[]');
        const localScores = JSON.parse(localStorage.getItem(`harmony_scores_${date}`) || '{}');
        const localAtt    = JSON.parse(localStorage.getItem(`harmony_attendance_${date}`) || '{}');

        // 2. 如果本地没有缓存，才等 Firebase（首次加载某天数据）
        let appts = localAppts, scores = localScores, att = localAtt;
        if (localAppts.length === 0) {
            try {
                const docSnap = await db.collection("spa_data").doc(date).get();
                if (docSnap.exists) {
                    const data = docSnap.data();
                    appts  = JSON.parse(data.appts  || '[]');
                    scores = JSON.parse(data.scores || '{}');
                    att    = JSON.parse(data.att    || '{}');
                    localStorage.setItem(`harmony_appts_${date}`,  JSON.stringify(appts));
                    localStorage.setItem(`harmony_scores_${date}`, JSON.stringify(scores));
                    localStorage.setItem(`harmony_attendance_${date}`, JSON.stringify(att));
                    if (data.shifts) {
                        localStorage.setItem(`harmony_shifts_${date}`, data.shifts);
                        window.staffShifts = JSON.parse(data.shifts);
                    }
                }
            } catch(e) {
                console.warn("Firebase 拉取失败，使用本地缓存:", e);
            }
        } else {
            // 3. 本地有缓存时：后台悄悄从 Firebase 同步最新数据（不阻塞渲染）
            db.collection("spa_data").doc(date).get().then(docSnap => {
                if (!docSnap.exists) return;
                const data = docSnap.data();
                const cloudAppts = JSON.parse(data.appts || '[]');
                // 只有云端数据更新时才刷新
                const localStr = localStorage.getItem(`harmony_appts_${date}`) || '[]';
                if (JSON.stringify(cloudAppts) !== localStr) {
                    const cloudScores = JSON.parse(data.scores || '{}');
                    const cloudAtt    = JSON.parse(data.att    || '{}');
                    localStorage.setItem(`harmony_appts_${date}`,  JSON.stringify(cloudAppts));
                    localStorage.setItem(`harmony_scores_${date}`, JSON.stringify(cloudScores));
                    localStorage.setItem(`harmony_attendance_${date}`, JSON.stringify(cloudAtt));
                    if (data.shifts) {
                        localStorage.setItem(`harmony_shifts_${date}`, data.shifts);
                        window.staffShifts = JSON.parse(data.shifts);
                    }
                    window.appointments = upgradeAppts(cloudAppts);
                    window.attendance = cloudAtt;
                    STAFF.forEach(s => { s.score = cloudScores[s.name] !== undefined ? cloudScores[s.name] : 0; });
                    if (typeof renderAll === 'function') renderAll();
                }
            }).catch(e => console.warn("后台同步失败:", e));
        }

        // 4. 注册实时监听
        Storage.listenToDate(date);

        return {
            appts: upgradeAppts(appts),
            scores: scores,
            att: att
        };
    },

    // =====================================================
    // 📡 实时监听：云端有变化自动更新本地 + 刷新界面
    // =====================================================
    listenToDate: (date) => {
        // 避免重复注册同一天的监听
        if (_currentListeningDate === date) return;

        // 取消旧监听
        if (_unsubscribe) _unsubscribe();

        _currentListeningDate = date;

        _unsubscribe = db.collection("spa_data").doc(date).onSnapshot(docSnap => {
            if (!docSnap.exists) return;

            // 如果是自己刚保存触发的，跳过（避免重复渲染）
            if (_justSaved) return;

            const data = docSnap.data();
// 🚀 核心同步：从云端下载班次并存入本地
if (data.shifts) {
    // 把云端的班次存在本地，这样刷新页面也不会丢
    localStorage.setItem(`harmony_shifts_${_currentListeningDate}`, data.shifts);
    // 让内存里的变量立刻生效，不用刷新页面也能看到排班变了
    window.staffShifts = JSON.parse(data.shifts); 
}

            // 云端数据来了，更新本地缓存
            const cloudAppts  = JSON.parse(data.appts || '[]');
            const cloudScores = JSON.parse(data.scores || '{}');
            const cloudAtt    = JSON.parse(data.att || '{}');

            localStorage.setItem(`harmony_appts_${date}`, JSON.stringify(cloudAppts));
            localStorage.setItem(`harmony_scores_${date}`, JSON.stringify(cloudScores));
            localStorage.setItem(`harmony_attendance_${date}`, JSON.stringify(cloudAtt));

            // 更新内存中的全局变量
            window.appointments = upgradeAppts(cloudAppts);
            window.attendance = cloudAtt;
            STAFF.forEach(s => {
                s.score = cloudScores[s.name] !== undefined ? cloudScores[s.name] : 0;
            });

            // 刷新界面
            if (typeof renderAll === 'function') {
                console.log("📡 云端有更新，界面已刷新");
                renderAll();
            }
        }, e => {
            console.error("🔥 实时监听失败:", e);
        });
    }
};

// =====================================================
// 📤 导出备份
// =====================================================
window.exportDailyData = async () => {
    const dateVal = document.getElementById('book-date').value;
    const appts  = JSON.parse(localStorage.getItem(`harmony_appts_${dateVal}`) || '[]');
    const scores = JSON.parse(localStorage.getItem(`harmony_scores_${dateVal}`) || '{}');
    const att    = JSON.parse(localStorage.getItem(`harmony_attendance_${dateVal}`) || '{}');
    const dataStr = JSON.stringify({ date: dateVal, appts, scores, att });
    const encodedData = btoa(encodeURIComponent(dataStr));
    navigator.clipboard.writeText(encodedData).then(() => {
        alert(`【${dateVal}】的数据已复制！`);
    }).catch(() => {
        console.log("同步码：", encodedData);
        alert("请手动复制控制台里的同步码。");
    });
};

// =====================================================
// 📥 导入备份
// =====================================================
window.importDailyData = async () => {
    const raw = prompt("请粘贴完整的同步码：");
    if (!raw) return;
    try {
        const cleanCode = raw.replace(/\s/g, '').replace(/\uFEFF/g, '');
        const decoded = atob(cleanCode);
        const data = JSON.parse(decodeURIComponent(decoded));
        if (confirm(`已识别数据：\n日期：${data.date}\n订单：${data.appts.length} 个\n确认覆盖吗？`)) {
            await Storage.save(data.date, data.appts, data.scores, data.att);
            alert("✅ 同步成功！");
            window.location.href = `index.html?date=${data.date}`;
        }
    } catch (e) {
        console.error("同步失败:", e);
        alert("❌ 导入失败！请确认同步码完整。");
    }
};
