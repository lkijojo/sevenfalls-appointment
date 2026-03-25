/**
 * js/app-init.js - 页面初始化与基础事件绑定
 */
window.appointments = []; 
window.attendance = {};
window.editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const dateIn = document.getElementById('book-date');
    const timeIn = document.getElementById('book-time');
    const maleCheck = document.getElementById('exclude-male');

    // --- 1. 日期初始化 ---
    const urlParams = new URLSearchParams(window.location.search);
    const dateFromUrl = urlParams.get('date');
    if (dateFromUrl) {
        dateIn.value = dateFromUrl;
    } else if (!dateIn.value) {
        dateIn.value = new Date().toISOString().split('T')[0];
    }

    // --- 2. 加载数据 ---
    let { appts, scores, att } = await Storage.load(dateIn.value);
    window.appointments = appts; 
    window.attendance = att;

    // --- 3. 初始化技师列表 ---
    STAFF.forEach(s => {
        s.score = (scores && scores[s.name] !== undefined) ? scores[s.name] : 0;
        // 核心修复：只要这个技师在当天的记录里没搜到，就按默认规则加载
if (attendance[s.name] === undefined) {
    attendance[s.name] = (s.name !== "Fei");
}
    });

    // --- 4. 绑定基础 UI 事件 ---
    if (maleCheck) maleCheck.addEventListener('change', renderAll);
    // 🚀 核心新增：监听“执行顺序”下拉框，改变时立刻刷新推荐积木
    const comboOrderSel = document.getElementById('combo-order');
    if (comboOrderSel) {
        comboOrderSel.addEventListener('change', () => {
            // 使用上面已经定义好的 dateIn 变量获取当前日期
            if (dateIn.value) {
                window.showSuggestions(dateIn.value);
                console.log("执行顺序已变更，推荐位已实时刷新");
            }
        });
    }
    if (timeIn) {
        timeIn.addEventListener('focus', () => {
            if (dateIn.value) window.showSuggestions(dateIn.value);
        });
    timeIn.addEventListener('input', () => {
            if (dateIn.value) window.showSuggestions(dateIn.value);
        });
    }

    // --- 5. 清空今日数据功能 ---
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.onclick = () => {
            const dateVal = dateIn.value;
            if(confirm(`确定清空 ${dateVal} 的全部数据？此操作不可恢复。`)) {
                    window.appointments = [];  // 🚀 加个 window.
                    STAFF.forEach(s => s.score = 0);
                    window.attendance = {};    // 🚀 加个 window.
                    Storage.save(dateVal, [], {}, {}); 
                    window.location.reload(); 
            }
        };
    }

    // 首次进入刷新看板
    renderAll();
    // 读取今天的班次时间
    if (window.loadShiftTimes) window.loadShiftTimes(dateIn.value);
    // 初始化下拉框规格
    if (window.updateSubItems) window.updateSubItems();
});

// 🚀 切换日期：不刷页面，直接重新加载数据
window.switchDate = async (newDate) => {
    if (!newDate) return;
    history.replaceState(null, '', '?date=' + newDate);
    window.editingId = null;
    window.currentSelectedProjects = [];
    if (typeof window.renderProjectList === 'function') window.renderProjectList();
    let { appts, scores, att } = await Storage.load(newDate);
    window.appointments = appts;
    window.attendance = att;
    STAFF.forEach(s => {
        s.score = (scores && scores[s.name] !== undefined) ? scores[s.name] : 0;
        if (att[s.name] === undefined) att[s.name] = (s.name !== "Fei");
    });
    if (window.loadShiftTimes) window.loadShiftTimes(newDate);
    renderAll();
};

// 计算积分
window.recalculateScores = () => {
    STAFF.forEach(s => s.score = 0); 
    appointments.forEach(appt => {
        const names = Array.isArray(appt.staff) ? appt.staff : [appt.staff];
        names.forEach(name => {
            const sObj = STAFF.find(s => s.name === name);
            if (sObj) sObj.score += (appt.weight || 0); 
        });
    });
    return getScoresMap();
};

function getScoresMap() { let sm = {}; STAFF.forEach(s => sm[s.name] = s.score); return sm; }