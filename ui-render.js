/**
 * js/ui-render.js - 负责界面刷新与渲染
 */

function renderAll() {
    const dateVal = document.getElementById('book-date').value;
    if (!dateVal) return;

    // 🚀 搬到这里！确保全函数（包括下方的订单表）都能访问到颜色
    const staffColors = {
        "Ivy": "#14B8A6", "Tracy": "#D53F8C", "Russell": "#1D7DFC",
        "Mia": "#3B82F6", "Jessie": "#6366F1", "Vanessa": "#10B981",
        "Coco": "#84CC16", "Michelle": "#C2410C", "Cat": "#3730A3",
        "Helen": "#D97706", "Fei": "#4A5568"
    };

    
    // --- 1. 房源看板：显示每个房间的空/忙状态 ---
    const rb = document.getElementById('room-board');
    if (rb) {
        rb.innerHTML = '';
        ROOMS.forEach(r => {
            const dayAppts = appointments.filter(a => a.date === dateVal && a.room.id === r.id)
                                         .sort((a, b) => timeToMin(a.roomStart) - timeToMin(b.roomStart));
            const day = new Date(dateVal.replace(/-/g, "/")).getDay();
        const openMin = (day === 0 || day === 6) ? timeToMin(CONFIG.WEEKEND_OPEN) : timeToMin(CONFIG.WEEKDAY_OPEN);
        const closeMin = timeToMin(CONFIG.getCloseTime(dateVal)); 
            let html = `<div style="text-align:center; font-weight:bold; margin-bottom:6px; border-bottom:1px solid #eee;">${r.name}</div>`;
            let lastEnd = openMin;

            dayAppts.forEach(a => {
                let startMin = timeToMin(a.roomStart);
                if (startMin > lastEnd) {
                    let gap = startMin - lastEnd;

                    // 1. 定义你要求的所有特定黄金数字
                    const goldenNumbers = [70, 100, 170, 240, 270, 310, 340, 370, 380, 410, 440, 450, 470, 480, 510, 520, 540, 550, 570, 580, 590, 610, 620, 640, 650, 660, 670, 680, 690, 710, 720, 730];

                    // 2. 核心判定：特定数字 OR 70倍数 OR 100倍数
                    let isStandard = goldenNumbers.includes(gap) || 
                    (gap > 0 && gap % 70 === 0) || 
                    (gap > 0 && gap % 100 === 0);

// --- 这样 140 (70x2), 200 (100x2), 210 (70x3) 全都会带星 ⭐ ---
                    // 🚀 修复点 1：使用标准引号嵌套，确保 class 成功挂载
                const bgColor = isStandard ? '#C6F6D5' : '#EDF2F7'; // 先算好颜色
html += `<div class="status-capsule free-style" 
              style="background:${bgColor}; cursor:pointer;" 
              onclick="document.getElementById('book-time').value='${minToTime(lastEnd)}'; window.showSuggestions('${dateVal}')"
    空 ${minToTime(lastEnd)}-${a.roomStart}<br>
    <span class="duration-text">(${gap}m)${isStandard ? '⭐' : ''}</span>
</div>`;
                }

                // 1. 获取基本状态
const isReq = !!a.isRequest;
const currentEndMin = timeToMin(a.roomEnd); // 这一单包含打扫的结束时间 (如 12:30)

// 🚀 核心逻辑：精准判定“极限订单” (往后看，谁追了我的尾)
// 在当天的同房订单里，找有没有任何一单的开始时间，早于我这单的结束时间
const nextAppt = dayAppts.find(next => 
    String(next.id) !== String(a.id) && 
    timeToMin(next.roomStart) < currentEndMin && 
    timeToMin(next.roomStart) >= timeToMin(a.roomStart)
);
const isExtremeGap = !!nextAppt; // 如果有人“追尾”了我的打扫时间，我就标黄

// 3. 颜色分配：已结束灰色 > 正在进行高亮 > 极限橘色 > 指定紫色 > 普通红色
const todayStr2 = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
const isToday2 = dateVal === todayStr2;
const nowMin2 = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
const rStartMin = timeToMin(a.roomStart);
const rEndMin = timeToMin(a.roomEnd);
const rIsDone = isToday2 && nowMin2 >= rEndMin;
const rIsNow = isToday2 && nowMin2 >= rStartMin && nowMin2 < rEndMin;

let busyBg = isReq ? '#E9D8FD' : '#FED7D7';
if (isExtremeGap) busyBg = '#F6AD55';
if (rIsDone) busyBg = '#EDF2F7'; // 已结束 → 灰色
if (rIsNow) busyBg = isReq ? '#D6BCFA' : '#FC8181'; // 正在进行 → 更深色

// 4. 渲染 HTML
                // 判断是否需要显示执行顺序标签
                const hasFootUsage = (a.projectSnapshot || []).some(p => (p.footDur && p.footDur > 0) || p.category === 'foot');
                const hasRoomUsage = (a.projectSnapshot || []).some(p => p.category === 'body' || p.category === 'facial' || p.category === 'combo');
                const orderTag = (hasFootUsage && hasRoomUsage && a.comboOrder)
                    ? `<span style="font-size:9px;margin-left:3px;color:#718096;">(${a.comboOrder === 'foot-first' ? '先脚' : '先身'})</span>`
                    : '';
                html += `<div class="status-capsule busy-style" 
                              draggable="true"
                              style="background:${busyBg}; cursor:grab; ${rIsDone ? 'opacity:0.6;' : ''} ${rIsNow ? 'box-shadow:0 0 0 2px #E53E3E60;' : ''}" 
                              ondragstart="window.onDragStart(event, '${a.id}', 'room', '')"
                              onclick="event.stopPropagation(); window.editAppt('${a.id}')">
                    ${isReq ? '⭐ ' : ''}${rIsNow ? '🔴 ' : ''}忙 ${a.roomStart}-${a.roomEnd}${orderTag}
                </div>`;
                
                lastEnd = timeToMin(a.roomEnd);
            });

            if (closeMin > lastEnd) {
                // 🚀 修复点 3：确保最后一段空闲时间也拥有 class
                let gapClose = closeMin - lastEnd;
html += `<div class="status-capsule free-style" style="background:#EDF2F7;">
    空 ${minToTime(lastEnd)}-${minToTime(closeMin)}<br>
    <span class="duration-text">(${closeMin - lastEnd}m)</span>
</div>`;
            }
            rb.innerHTML += `<div class="card" style="min-height:80px; text-align:left; padding:8px; border:1px solid #E2E8F0;"
    data-room-id="${r.id}"
    ondragover="event.preventDefault(); this.style.outline='2px dashed #319795';"
    ondragleave="this.style.outline='';"
    ondrop="this.style.outline=''; window.onDropRoom(event, '${r.id}')"
>${html}</div>`;
        });
    }
    // --- 🚀 渲染竖版技师实时忙碌看板 ---
    const sbb = document.getElementById('staff-busy-board');
    if (sbb) {
        sbb.innerHTML = '';
        // 1. 过滤出当前出勤的技师
        const activeStaff = STAFF.filter(s => attendance[s.name] !== false);

        activeStaff.forEach(s => {
    const themeColor = staffColors[s.name] || "#4299E1"; 

    // 2. 查找该技师当天的所有预约并排序
    const staffAppts = appointments.filter(a => 
        a.date === dateVal && 
        (Array.isArray(a.staff) ? a.staff.includes(s.name) : a.staff === s.name)
    ).sort((a, b) => timeToMin(a.start) - timeToMin(b.start));

    // 3. 构建竖向内容 (使用主题色作为名字下划线)
    let apptsHtml = `<div style="text-align:center; font-weight:bold; margin-bottom:10px; border-bottom:2px solid ${themeColor}; color:#2D3748; padding-bottom:5px;">${s.name}</div>`;
            
            if (staffAppts.length === 0) {
                apptsHtml += `<div style="color:#CBD5E0; font-size:12px; text-align:center; padding:20px 0;">今日无单</div>`;
            } else {
                // --- 🚀 插入位置：ui-render.js 第 106 行 ---
const day = new Date(dateVal.replace(/-/g, "/")).getDay();
const openMin = (day === 0 || day === 6) ? timeToMin(CONFIG.WEEKEND_OPEN) : timeToMin(CONFIG.WEEKDAY_OPEN);
const closeMin = timeToMin(CONFIG.getCloseTime(dateVal));
// 🚀 从技师实际上班时间开始算等待
const staffShiftsNow = window.staffShifts || {};
const staffStartMin = staffShiftsNow[s.name] ? timeToMin(staffShiftsNow[s.name].start) : openMin;
const staffEndMin = staffShiftsNow[s.name] ? timeToMin(staffShiftsNow[s.name].end) : closeMin;
let lastEnd = staffStartMin;

staffAppts.forEach(a => {
    const startMin = timeToMin(a.start);
    
    // 🚀 核心逻辑：如果当前预约开始时间 > 上一个结束时间，显示等了多久
    // --- 修改截图第 115 行附近的逻辑 ---
        if (startMin > lastEnd) {
            const gap = startMin - lastEnd;
            if (gap >= 30) {  // 👈 只有满 30 分钟才显示
                const gapH1 = Math.floor(gap / 60), gapM1 = gap % 60;
                const gapStr1 = gap >= 60 ? `${gapH1}h ${gapM1}m` : `${gap}m`;
                apptsHtml += `
                    <div style="background:#f1f3f5; color:#adb5bd; font-size:10px; text-align:center; padding:4px 0; margin-bottom:4px; border:1px dashed #dee2e6; border-radius:4px;">
                        等 ${gapStr1}
                    </div>`;
            }
        }

const isReq = a.isRequest && (a.savedStaff1 === s.name || a.savedStaff2 === s.name);
const todayStr = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
const isToday = dateVal === todayStr;
const nowMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
const aStartMin2 = timeToMin(a.start);
const aEndMin2 = aStartMin2 + (a.duration || 60);
const isDone = isToday && nowMin >= aEndMin2;
const isNow = isToday && nowMin >= aStartMin2 && nowMin < aEndMin2;
const cardBg = isDone ? '#F7FAFC' : isNow ? themeColor + '30' : themeColor + '15';
const borderColor = isDone ? '#CBD5E0' : themeColor;
const textColor = isDone ? '#A0AEC0' : themeColor;
const nameColor = isDone ? '#A0AEC0' : '#4A5568';
apptsHtml += `
    <div class="status-capsule"
         draggable="true"
         style="background:${cardBg}; border-left:4px solid ${borderColor}; margin-bottom:4px; padding:6px; border-radius:6px; cursor:grab; ${isNow ? 'box-shadow:0 0 0 2px ' + themeColor + '60;' : ''}"
         ondragstart="window.onDragStart(event, '${a.id}', 'staff', '${s.name}')"
         onclick="event.stopPropagation(); window.editAppt('${a.id}')">
        <div style="font-weight:bold; color:${textColor}; font-size:11px;">${isReq ? '⭐' : ''}${isNow ? '🔴 ' : ''}${a.start}-${a.end}</div>
        <div style="font-size:10px; color:${nameColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">👤 ${a.customerName}</div>
    </div>`;
    
    lastEnd = timeToMin(a.end); // 更新结束时间
});

// 🚀 补充：最后一段空闲到下班时间
if (staffEndMin > lastEnd) {
    const finalGap = staffEndMin - lastEnd;
    if (finalGap >= 30) {
        const fH = Math.floor(finalGap / 60), fM = finalGap % 60;
        const fStr = finalGap >= 60 ? `${fH}h ${fM}m` : `${finalGap}m`;
        apptsHtml += `
            <div style="background:#f1f3f5; color:#adb5bd; font-size:10px; text-align:center; padding:4px 0; border-radius:4px; margin-top:2px;">
                空 ${fStr}
            </div>`;
    }
}

// 🚀 计算并显示全天总等待时长
{
    const sAppts2 = appointments
        .filter(a => a.date === dateVal && (Array.isArray(a.staff) ? a.staff : [a.staff]).includes(s.name))
        .sort((x, y) => timeToMin(x.start) - timeToMin(y.start));
    let totalWait2 = 0, cur2 = staffStartMin;
    sAppts2.forEach(a => {
        const aS = timeToMin(a.start);
        if (aS > cur2) totalWait2 += aS - cur2;
        cur2 = Math.max(cur2, aS + (a.duration || 60));
    });
    const tH = Math.floor(totalWait2 / 60), tM = totalWait2 % 60;
    const tStr = totalWait2 >= 60 ? `${tH}h ${tM}m` : `${totalWait2}m`;
    apptsHtml += `
        <div style="margin-top:8px; padding:5px 6px; background:#EBF8FF; border-top:1px solid #BEE3F8; border-radius:4px; font-size:10px; color:#2C5282; text-align:center; font-weight:600;">
            总等待 ${tStr}
        </div>`;
}
            }

            // 4. 封装成卡片，确保类名与房间看板一致以实现横向排列
            // 🚀 修改点：去掉固定宽度，使用 flex: 1 让所有技师卡片在同一行内平分空间
sbb.innerHTML += `
                <div class="card" style="flex: 1; min-width: 0; padding: 6px; border: 1px solid #E2E8F0; background:#fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column;"
                    data-staff-name="${s.name}"
                    ondragover="event.preventDefault(); this.style.outline='2px dashed #319795';"
                    ondragleave="this.style.outline='';"
                    ondrop="this.style.outline=''; window.onDropStaff(event, '${s.name}')">
                    ${apptsHtml}
                </div>`;
        }); // 👈 这是第 172 行，结束 activeStaff.forEach
    } // 👈 这是原来的第 174 行，现在应该上移一行，结束 if (sbb)

    // --- 2. 技师管理：出勤开关与状态看板 ---
    const sb = document.getElementById('staff-board');
    const s1 = document.getElementById('staff-1');
    const s2 = document.getElementById('staff-2');
    const attDiv = document.getElementById('attendance-toggles');
    const hideMale = document.getElementById('exclude-male')?.checked;

    if (sb && s1 && s2 && attDiv) {
        sb.innerHTML = ''; 
        attDiv.innerHTML = '';
        const autoOpt = '<option value="AUTO">✨ 自动分配 (积分最少)</option>';
        s1.innerHTML = autoOpt;
        s2.innerHTML = autoOpt;

        STAFF.forEach(s => {
            if (s.name === "Fei" && attendance[s.name] === undefined) { attendance[s.name] = false; }
            const isAttending = attendance[s.name] !== false;
            attDiv.innerHTML += `
                <label style="margin-right:15px; cursor:pointer; font-size:13px;">
                    <input type="checkbox" ${isAttending ? 'checked' : ''} 
                           onclick="window.toggleAtt('${s.name}')"> ${s.name}
                </label>`;

            if (isAttending) {
                if (hideMale && s.name === "Russell") return; 
                const displayScore = Math.round(s.score * 10) / 10;
                sb.innerHTML += `<div class="card available" onclick="window.showScoreDetail('${s.name}')" style="cursor:pointer;" title="点击查看积分明细"><b>${s.name}</b><br><span>${displayScore}分</span></div>`;
                const opt = `<option value="${s.name}">${s.name} (${displayScore}分)</option>`;
                s1.innerHTML += opt;
                s2.innerHTML += opt; 
            }
        });

        // 🚀 核心强刷逻辑：如果正在编辑模式，强制在渲染后把选中的技师抓回来
        if (window.editingId) {
            const tar = appointments.find(a => String(a.id) === String(window.editingId));
            if (tar) {
                // 找到这个单子保存时或者刚才选中的技师意向
                const staffArray = Array.isArray(tar.staff) ? tar.staff : [tar.staff];
                const s1Target = tar.savedStaff1 || (tar.isRequest ? staffArray[0] : "AUTO");
                
                // 强行赋值，覆盖 renderAll 的默认重置
                s1.value = s1Target;
                
                // 如果是情侣模式，也要抓回第二个技师
                if (s2.style.display !== 'none') {
                    const s2Target = tar.savedStaff2 || (staffArray.length > 1 && tar.isRequest ? staffArray[1] : "AUTO");
                    s2.value = s2Target;
                }
            }
        }
    }

    // --- 3. 订单表格：显示今天的预约单 ---
    const tbody = document.getElementById('appointment-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        // 1. 获取搜索框里的内容
const searchText = document.getElementById('order-search')?.value.toLowerCase() || "";

// 2. 增强版的过滤逻辑
appointments.filter(a => {
    // 匹配日期
    const isToday = a.date === dateVal;
    
    // 匹配搜索：姓名、项目大类/规格、或技师名字
            const staffStr = Array.isArray(a.staff) ? a.staff.join(' ') : (a.staff || "");
            const roomName = a.room ? a.room.name : ""; // 🚀 获取房间名 (如 "Room 1")

            const matchesSearch = !searchText || 
                (a.customerName || "").toLowerCase().includes(searchText) || 
                (a.type || "").toLowerCase().includes(searchText) ||
                staffStr.toLowerCase().includes(searchText) ||
                roomName.toLowerCase().includes(searchText); // 🚀 允许通过房间名搜索

    return isToday && matchesSearch;
})
            .sort((a, b) => timeToMin(a.start) - timeToMin(b.start))
            .forEach((a) => {
                // --- 🚀 核心渲染修复：判断 isRequest 显示紫色和星星 ---
                // 🚀 核心渲染修复：拆分技师，仅针对手动指定的技师显示紫色和星星
                const staffArray = Array.isArray(a.staff) ? a.staff : [a.staff];
        // --- 🚀 彻底还原为之前的基础文字模式 ---
const staffDisplay = staffArray.map((name, idx) => {
    const savedIntent = idx === 0 ? a.savedStaff1 : a.savedStaff2;
    const isThisOneManual = !!a.isRequest && savedIntent !== "AUTO" && savedIntent !== "";
    
    // 1. 如果是点名的(Request)，显示醒目的红色+粗体+星星
    // 2. 如果是普通单子，显示默认颜色（#2D3748），不再带有任何技师代表色
    if (isThisOneManual) {
        return `<span style="color:#E53E3E; font-weight:bold; font-size:13px;">⭐${name}</span>`;
    } else {
        return `<span style="color:#2D3748; font-weight:500; font-size:13px;">${name}</span>`;
    }
}).join(' & ');
                const dur = a.duration || (timeToMin(a.end) - timeToMin(a.start));
                tbody.innerHTML += `<tr>
    <td>
        <input type="checkbox" class="order-checkbox" data-id="${a.id}">
    </td>
    <td>
                        <div style="font-weight:bold; color:#2D3748;">${a.start}-${a.end}</div>
                        <div style="font-size:11px; color:#319795; font-weight:bold; margin-top:2px;">
                            👤 ${a.customerName || '未定义'}${a.excludeMale ? '<span style="color:#E53E3E; margin-left:4px;">(不要男)</span>' : ''}
                        </div>
                        <div style="font-size:11px; color:#718096; margin-top:2px;">⏳ ${dur}m</div>
                    </td>
                    <td style="font-size:13px;">${a.room.name}</td>
                    <td>${staffDisplay}</td>
                     <td style="font-size:12px; color:#4A5568;">
     ${(a.treatment && !(a.projectSnapshot || []).every(p => p.category === 'facial')) ? `<span style="color:#319795; font-weight:bold; margin-right:4px;">[${a.treatment}]</span>` : ''}
     <span style="font-weight:500;">${a.type}</span>  
${(() => {
    // 1. 获取项目快照并判定是否为混合项目
    const projects = a.projectSnapshot || [];
    
    // 🚀 核心改进：判定是否真的有大厅洗脚行为 (footDur > 0)
    const hasFootService = projects.some(p => (p.footDur && p.footDur > 0));
    const hasRoomService = projects.some(p => p.category === 'body' || p.category === 'facial' || p.category === 'combo');
    
    // 2. 只有“带洗脚时长”且“需要进房”的混合项目才显示标签
    if (hasFootService && hasRoomService) {
        // 🚀 严格匹配：只有明确是 foot-first 才显绿，明确是 body-first 才显蓝
        if (a.comboOrder === 'foot-first') {
            return '<span style="color:#38A169; font-weight:bold; margin-left:4px;">[🦶先脚]</span>';
        } else if (a.comboOrder === 'body-first') {
            return '<span style="color:#3182CE; font-weight:bold; margin-left:4px;">[💆先身]</span>';
        } else {
            // 对于导入时没对上推荐位的单子，显示灰色 [❓未选]
            return '<span style="color:#718096; font-weight:bold; margin-left:4px;">[❓未选]</span>';
        }
    }
    return ''; // 纯足疗或纯身体不显示标签
})()}
                    </td>
                    <td>
                        <button type="button" onclick="window.editAppt('${a.id}')" style="margin-right:8px; color:#319795; cursor:pointer; border:none; background:none; font-size:16px;">📝</button>
                        <button onclick="window.deleteAppt('${a.id}')" style="color:#E53E3E; cursor:pointer; border:none; background:none; font-size:16px;">✕</button>
                    </td>
                </tr>`;
            });
    }
}

window.toggleAtt = (name) => {
    const dateVal = document.getElementById('book-date').value; 
    attendance[name] = !attendance[name];

    // 🚀 核心修改：这里不要用旧账本，直接叫“计算员”现场算一遍
    const latestScores = window.recalculateScores(); 

    // 把算好的最新分数存进去
    Storage.save(dateVal, appointments, latestScores, attendance);
    
    renderAll();
};

window.getScoresMap = function() { 
    let sm = {}; 
    STAFF.forEach(s => sm[s.name] = s.score); 
    return sm; 
};
// 🚀 核心：一键全选逻辑 (添加在文件末尾)
window.toggleAllOrders = (isCheck) => {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = isCheck;
    });
};

// 🚀 核心：获取选中 ID (供以后批量操作使用)
window.getSelectedOrderIds = () => {
    const checkedBoxes = document.querySelectorAll('.order-checkbox:checked');
    return Array.from(checkedBoxes).map(cb => cb.getAttribute('data-id'));
};
// 🚀 新增：计算“实打实”的积分（排除勾选且非指定的单子）
window.getRealSolidScores = () => {
    let scores = {};
    // 初始化所有技师为 0 分
    STAFF.forEach(s => scores[s.name] = 0);

    // 获取当前选中的 ID 列表
    const selectedIds = window.getSelectedOrderIds ? window.getSelectedOrderIds() : [];

    // 扫描所有订单
    appointments.forEach(a => {
        // 核心逻辑：只有【没勾选的】或者【虽然勾选了但是点名的 ⭐】才算进“底实”积分
        const isSelected = selectedIds.includes(String(a.id));
        if (!isSelected || a.isRequest) {
            const staffArray = Array.isArray(a.staff) ? a.staff : [a.staff];
            staffArray.forEach(name => {
                if (scores[name] !== undefined) {
                   scores[name] += (a.weight || 1.0);
                }
            });
        }
    });
    return scores;
};
// 🚀 核心修复：监听每一个小框的状态，实时联动表头的“全选”框
document.addEventListener('change', (e) => {
    // 只处理类名为 order-checkbox 的勾选框
    if (e.target.classList.contains('order-checkbox')) {
        const checkAll = document.getElementById('check-all');
        if (!checkAll) return;

        // 获取当前页面上所有的订单勾选框
        const allCheckboxes = document.querySelectorAll('.order-checkbox');
        // 获取当前被勾选的数量
        const checkedCount = document.querySelectorAll('.order-checkbox:checked').length;

        // ✨ 自动联动逻辑：
        // 只有当“勾选数量”等于“总数量”且大于 0 时，全选框才勾上；
        // 只要有一个没勾，全选框就会自动取消勾选。
        checkAll.checked = (allCheckboxes.length > 0 && checkedCount === allCheckboxes.length);
        
        // 可选：同步行高亮视觉效果
        const row = e.target.closest('tr');
        if (row) {
            row.style.background = e.target.checked ? 'rgba(49, 130, 206, 0.02)' : 'transparent';
        }
    }
});
// ℹ️ editAppt 完整定义在 ui-project-manager.js，此处不重复定义
// ============================================================
// 🕐 班次时间设置弹窗
// ============================================================

function generateTimeOptions(selectedVal) {
    let opts = '';
    for (let h = 8; h <= 22; h++) {
        ['00', '30'].forEach(m => {
            const val = `${h.toString().padStart(2,'0')}:${m}`;
            opts += `<option value="${val}" ${val === selectedVal ? 'selected' : ''}>${val}</option>`;
        });
    }
    return opts;
}

window.openShiftModal = () => {
    const dateVal = document.getElementById('book-date').value;
    const day = new Date(dateVal.replace(/-/g, '/')).getDay();
    const defaultOpen = (day === 0 || day === 6) ? '09:30' : '10:00';
    const defaultClose = (day === 0 || day === 6) ? '21:00' : '20:00';

    const saved = JSON.parse(localStorage.getItem(`harmony_shifts_${dateVal}`) || '{}');
    const activeStaff = STAFF.filter(s => attendance[s.name] !== false);

    const body = document.getElementById('shift-modal-body');
    if (!body) return alert('弹窗元素未找到，请检查 index.html 是否包含最新版本');
    
    body.innerHTML = activeStaff.map(s => {
        const shift = saved[s.name] || { start: defaultOpen, end: defaultClose };
        return `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
            <span style="width:80px; font-weight:600; font-size:14px;">${s.name}</span>
            <select id="shift-start-${s.name}" style="flex:1; padding:6px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px;">
                ${generateTimeOptions(shift.start)}
            </select>
            <span style="color:#718096;">到</span>
            <select id="shift-end-${s.name}" style="flex:1; padding:6px 10px; border:1.5px solid #e2e8f0; border-radius:8px; font-size:13px;">
                ${generateTimeOptions(shift.end)}
            </select>
        </div>`;
    }).join('');

    document.getElementById('shift-modal').style.display = 'flex';
};

window.closeShiftModal = () => {
    document.getElementById('shift-modal').style.display = 'none';
};

window.saveShiftTimes = () => {
    const dateVal = document.getElementById('book-date').value;
    const activeStaff = STAFF.filter(s => attendance[s.name] !== false);
    const shifts = {};
    activeStaff.forEach(s => {
        const start = document.getElementById(`shift-start-${s.name}`)?.value;
        const end = document.getElementById(`shift-end-${s.name}`)?.value;
        if (start && end) shifts[s.name] = { start, end };
    });
    localStorage.setItem(`harmony_shifts_${dateVal}`, JSON.stringify(shifts));
    window.staffShifts = shifts;
    // 🚀 核心修复：班次同步上传云端，防止刷新后被旧数据覆盖
    Storage.save(dateVal, window.appointments, window.recalculateScores(), window.attendance);
    window.closeShiftModal();
    renderAll();
    alert('✅ 班次已保存！');
};

window.loadShiftTimes = (dateVal) => {
    const saved = JSON.parse(localStorage.getItem(`harmony_shifts_${dateVal}`) || '{}');
    window.staffShifts = saved;
};

// ============================================================
// 🖱️ 拖拽重分配逻辑：换房间 / 换技师
// ============================================================

window.onDragStart = (event, apptId, dragType, fromStaff) => {
    event.dataTransfer.setData('apptId', apptId);
    event.dataTransfer.setData('dragType', dragType);
    event.dataTransfer.setData('fromStaff', fromStaff || '');
    event.dataTransfer.effectAllowed = 'move';
};

// ===================== 换房间 =====================
window.onDropRoom = async (event, targetRoomId) => {
    event.preventDefault();
    const apptId = event.dataTransfer.getData('apptId');
    const dragType = event.dataTransfer.getData('dragType');
    if (dragType !== 'room') return;

    const dateVal = document.getElementById('book-date').value;
    const appt = window.appointments.find(a => String(a.id) === String(apptId));
    if (!appt) return;
    if (String(appt.room.id) === String(targetRoomId)) return;

    const targetRoom = ROOMS.find(r => String(r.id) === String(targetRoomId));
    if (!targetRoom) return;

    const roomStart = timeToMin(appt.roomStart);
    const roomEnd = timeToMin(appt.roomEnd);
    const conflict = window.appointments.find(a =>
        a.date === dateVal &&
        String(a.room.id) === String(targetRoomId) &&
        String(a.id) !== String(apptId) &&
        roomStart < timeToMin(a.roomEnd) && roomEnd > timeToMin(a.roomStart)
    );

    if (conflict) {
        if (!confirm(`⚠️ ${targetRoom.name} 在该时段已有【${conflict.customerName}】的预约，确定还要强行移入吗？`)) return;
    } else {
        if (!confirm(`将【${appt.customerName}】从 ${appt.room.name} 移到 ${targetRoom.name}？`)) return;
    }

    appt.room = { id: parseInt(targetRoomId), name: targetRoom.name };
    await Storage.save(dateVal, window.appointments, window.recalculateScores(), window.attendance);
    renderAll();
};

// ===================== 换技师 =====================
window.onDropStaff = async (event, targetStaffName) => {
    event.preventDefault();
    const apptId = event.dataTransfer.getData('apptId');
    const dragType = event.dataTransfer.getData('dragType');
    if (dragType !== 'staff') return;

    const dateVal = document.getElementById('book-date').value;
    const appt = window.appointments.find(a => String(a.id) === String(apptId));
    if (!appt) return;

    const staffArray = Array.isArray(appt.staff) ? appt.staff : [appt.staff];
    if (staffArray.includes(targetStaffName)) return;

    // 拖的是哪个技师的块就换哪个
    const draggedStaffName = event.dataTransfer.getData('fromStaff');
    let replaceIdx = staffArray.indexOf(draggedStaffName);
    if (replaceIdx === -1) replaceIdx = 0;

    const apptStart = timeToMin(appt.start);
    const apptEnd = apptStart + (appt.duration || 60);
    const busy = window.appointments.find(a =>
        a.date === dateVal &&
        String(a.id) !== String(apptId) &&
        (Array.isArray(a.staff) ? a.staff : [a.staff]).includes(targetStaffName) &&
        apptStart < (timeToMin(a.start) + (a.duration || 60)) &&
        apptEnd > timeToMin(a.start)
    );

    if (busy) {
        if (!confirm(`⚠️ ${targetStaffName} 在该时段已有【${busy.customerName}】的预约，确定还要强行换入吗？`)) return;
    } else {
        const oldName = staffArray[replaceIdx];
        if (!confirm(`将【${appt.customerName}】的技师从 ${oldName} 换为 ${targetStaffName}？`)) return;
    }

    const newStaffArray = [...staffArray];
    newStaffArray[replaceIdx] = targetStaffName;
    appt.staff = newStaffArray;
    appt.savedStaff1 = newStaffArray[0] || 'AUTO';
    appt.savedStaff2 = newStaffArray[1] || 'AUTO';

    await Storage.save(dateVal, window.appointments, window.recalculateScores(), window.attendance);
    renderAll();
};

// ============================================================
// 📊 积分明细弹窗
// ============================================================
window.showScoreDetail = (staffName) => {
    const dateVal = document.getElementById('book-date').value;
    const staffAppts = window.appointments.filter(a =>
        a.date === dateVal &&
        (Array.isArray(a.staff) ? a.staff : [a.staff]).includes(staffName)
    ).sort((a, b) => timeToMin(a.start) - timeToMin(b.start));

    const renderModal = () => {
        let totalScore = 0;
        let rows = '';
        staffAppts.forEach(a => {
            const score = Math.round((a.weight || 0) * 10) / 10;
            totalScore += score;
            const treatment = a.treatment ? `[${a.treatment}]` : '';
            const projects = (a.projectSnapshot || []).map(p => p.name).join(' + ') || a.type || '-';
            rows += `
                <tr style="border-bottom:1px solid #EDF2F7;">
                    <td style="padding:8px 10px;font-size:13px;color:#2D3748;">${a.start}-${a.end}</td>
                    <td style="padding:8px 10px;font-size:13px;color:#4A5568;">${a.customerName || '-'}</td>
                    <td style="padding:8px 10px;font-size:13px;color:#4A5568;">
                        ${treatment ? `<span style="color:#319795;font-weight:bold;margin-right:4px;">${treatment}</span>` : ''}
                        ${projects}
                    </td>
                    <td style="padding:8px 10px;font-size:13px;font-weight:bold;color:#319795;text-align:right;white-space:nowrap;">
                        +${score}分
                        <button onclick="window.addBonusScore('${staffName}','${a.id}')" 
                            style="margin-left:6px;background:#EBF8FF;border:1px solid #BEE3F8;color:#2B6CB0;border-radius:6px;padding:2px 7px;font-size:11px;cursor:pointer;font-weight:bold;">+0.1</button>
                    </td>
                </tr>`;
        });

        if (rows === '') {
            rows = '<tr><td colspan="4" style="padding:20px;text-align:center;color:#A0AEC0;">今日暂无订单</td></tr>';
        }

        const totalRounded = Math.round(totalScore * 10) / 10;
        const inner = document.getElementById('score-detail-inner');
        if (inner) {
            inner.querySelector('tbody').innerHTML = rows;
            inner.querySelector('tfoot td:last-child').textContent = totalRounded + '分';
        }
    };

    const existing = document.getElementById('score-detail-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'score-detail-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:9999;display:flex;justify-content:center;align-items:center;';

    let totalScore = 0;
    let rows = '';
    staffAppts.forEach(a => {
        const score = Math.round((a.weight || 0) * 10) / 10;
        totalScore += score;
        const treatment = a.treatment ? `[${a.treatment}]` : '';
        const projects = (a.projectSnapshot || []).map(p => p.name).join(' + ') || a.type || '-';
        rows += `
            <tr style="border-bottom:1px solid #EDF2F7;">
                <td style="padding:8px 10px;font-size:13px;color:#2D3748;">${a.start}-${a.end}</td>
                <td style="padding:8px 10px;font-size:13px;color:#4A5568;">${a.customerName || '-'}</td>
                <td style="padding:8px 10px;font-size:13px;color:#4A5568;">
                    ${treatment ? `<span style="color:#319795;font-weight:bold;margin-right:4px;">${treatment}</span>` : ''}
                    ${projects}
                </td>
                <td style="padding:8px 10px;font-size:13px;font-weight:bold;color:#319795;text-align:right;white-space:nowrap;">
                    <span id="score-val-${a.id}">+${score}分</span>
                    <button onclick="window.addBonusScore('${staffName}','${a.id}')" 
                        style="margin-left:6px;background:#EBF8FF;border:1px solid #BEE3F8;color:#2B6CB0;border-radius:6px;padding:2px 7px;font-size:11px;cursor:pointer;font-weight:bold;">+0.1</button>
                    <button onclick="window.resetScore('${staffName}','${a.id}',${a.originalWeight || score})" 
                        style="margin-left:4px;background:#FFF5F5;border:1px solid #FED7D7;color:#C53030;border-radius:6px;padding:2px 7px;font-size:11px;cursor:pointer;font-weight:bold;">↩</button>
                </td>
            </tr>`;
    });

    if (rows === '') {
        rows = '<tr><td colspan="4" style="padding:20px;text-align:center;color:#A0AEC0;">今日暂无订单</td></tr>';
    }

    const totalRounded = Math.round(totalScore * 10) / 10;
    modal.innerHTML = `
        <div id="score-detail-inner" style="background:white;border-radius:16px;padding:28px;min-width:500px;max-width:90vw;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="margin:0;color:#2D3748;">📊 ${staffName} 积分明细</h3>
                <button onclick="document.getElementById('score-detail-modal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#718096;">✕</button>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#F7FAFC;">
                        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#718096;">时段</th>
                        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#718096;">客人</th>
                        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#718096;">项目 / 手法</th>
                        <th style="padding:8px 10px;text-align:right;font-size:12px;color:#718096;">积分</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr style="background:#E6FFFA;">
                        <td colspan="3" style="padding:10px;font-weight:bold;color:#2C7A7B;">合计</td>
                        <td id="score-detail-total" style="padding:10px;font-weight:bold;color:#2C7A7B;text-align:right;">${totalRounded}分</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
};

window.addBonusScore = async (staffName, apptId) => {
    const appt = window.appointments.find(a => String(a.id) === String(apptId));
    if (!appt) return;

    // 记录原始分数（第一次加分时保存）
    if (appt.originalWeight === undefined) appt.originalWeight = appt.weight || 0;

    // 加 0.1 分
    appt.weight = Math.round(((appt.weight || 0) + 0.1) * 10) / 10;

    // 更新弹窗里的显示
    const scoreVal = document.getElementById(`score-val-${apptId}`);
    if (scoreVal) scoreVal.textContent = `+${appt.weight}分`;

    // 重算合计
    const dateVal = document.getElementById('book-date').value;
    const staffAppts = window.appointments.filter(a =>
        a.date === dateVal &&
        (Array.isArray(a.staff) ? a.staff : [a.staff]).includes(staffName)
    );
    const total = Math.round(staffAppts.reduce((s, a) => s + (a.weight || 0), 0) * 10) / 10;
    const totalEl = document.getElementById('score-detail-total');
    if (totalEl) totalEl.textContent = total + '分';

    // 存档
    await Storage.save(dateVal, window.appointments, window.recalculateScores(), window.attendance);
    renderAll();
};

window.resetScore = async (staffName, apptId, originalWeight) => {
    const appt = window.appointments.find(a => String(a.id) === String(apptId));
    if (!appt) return;

    appt.weight = Math.round(originalWeight * 10) / 10;
    appt.originalWeight = undefined;

    const scoreVal = document.getElementById(`score-val-${apptId}`);
    if (scoreVal) scoreVal.textContent = `+${appt.weight}分`;

    const dateVal = document.getElementById('book-date').value;
    const staffAppts = window.appointments.filter(a =>
        a.date === dateVal &&
        (Array.isArray(a.staff) ? a.staff : [a.staff]).includes(staffName)
    );
    const total = Math.round(staffAppts.reduce((s, a) => s + (a.weight || 0), 0) * 10) / 10;
    const totalEl = document.getElementById('score-detail-total');
    if (totalEl) totalEl.textContent = total + '分';

    await Storage.save(dateVal, window.appointments, window.recalculateScores(), window.attendance);
    renderAll();
};

// 🚀 每分钟自动刷新看板，保持"已结束/进行中"颜色实时更新
setInterval(() => {
    if (typeof renderAll === 'function') renderAll();
}, 60000);
