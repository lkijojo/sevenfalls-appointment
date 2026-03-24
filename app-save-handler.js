/**
 * js/app-save-handler.js - 处理预约保存的核心逻辑
 */

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('save-btn');
    if (!saveBtn) return;

    saveBtn.onclick = async () => {
        // --- 🚀 修复点：确保获取全局编辑 ID ---
        const currentEditingId = window.editingId; 
        const customerName = document.getElementById('customer-name')?.value || "未定义";

        const dateIn = document.getElementById('book-date');
        const timeIn = document.getElementById('book-time');
        const dateVal = dateIn.value;
        const timeVal = timeIn.value;
        
        // 使用 optional chaining 防止因元素不存在报错
        const isCouple = document.getElementById('couple-mode')?.checked || false;
        const comboOrder = document.getElementById('combo-order')?.value || "body-first";
        const treatmentVal = document.getElementById('treatment-select')?.value || "Sw";
        const roomSelectVal = document.getElementById('room-select')?.value || "AUTO";

        // 1. 获取清单
        const projectList = window.currentSelectedProjects || [];
        if (!timeVal || projectList.length === 0) {
            return alert("请确保填写了时间，并点击【+加项】添加了项目！");
        }

        // 2. 累加计算
        const totalDur = projectList.reduce((sum, p) => sum + p.dur, 0);
        const totalFootDur = projectList.reduce((sum, p) => {
            if (p.category === 'foot') return sum + p.dur;
            return sum + (p.footDur || 0);
        }, 0);
        const allNames = projectList.map(p => p.name).join(' + ');
        const needsRoom = projectList.some(p => p.category !== 'foot');
        const startMin = timeToMin(timeVal);

        // 3. 计算房间占用
        let roomStart = startMin;
        if (needsRoom && comboOrder === 'foot-first') roomStart = startMin + totalFootDur;
        const actualRoomProjectDur = totalDur - totalFootDur; 
        // 🚀 修正：房间占用结束时间就是项目结束时间，不加清理时间
        let roomEnd = roomStart + actualRoomProjectDur + (CONFIG.CLEAN_TIME || 10);
        
// 4. 分房逻辑 (智能锁定增强版)
        let room = { id: 0, name: "Lobby" };
        if (needsRoom) {
            // 🚀 1. 翻旧账：找到原本的订单数据
            const existingAppt = currentEditingId ? appointments.find(a => String(a.id) === String(currentEditingId)) : null;
            const originalRoom = existingAppt ? existingAppt.room : null;
            
            // 🚀 2. 检查项目内容改了没
            const oldProjects = existingAppt?.projectSnapshot || [];
            const isProjectChanged = JSON.stringify(projectList) !== JSON.stringify(oldProjects);

            // 🚀 3. 核心冲突检测函数 (保持不变)
            const checkRoomConflict = (rId) => {
                let others = appointments;
                if (currentEditingId) {
                    others = appointments.filter(a => String(a.id) !== String(currentEditingId));
                }
            return others.some(a => {
            // 🚀 正确逻辑：如果日期或房间对不上，直接跳过(continue)，去查下一张单子
            if (a.date !== dateVal || String(a.room.id) !== String(rId)) return false;

            const aStartMin = timeToMin(a.roomStart);
            const aEndMin = timeToMin(a.roomEnd);
            
            // 🚀 核心改进：允许压线衔接 (13:00 等于 13:00 时不冲突)
            return (roomStart < aEndMin && roomEnd > aStartMin);
        });
            };

            // 🚀 4. 判定规则：下拉框指定 > 推荐积木点击 > 锁旧房 > 自动找房
        if (roomSelectVal !== "AUTO") {
            // 优先级 1：如果在左侧下拉框选了具体的房间 -> 强制锁定
            const manualRoom = ROOMS.find(r => String(r.id) === String(roomSelectVal));
            room = manualRoom;
        } else if (window.selectedRoomIdManual) {
            // 优先级 2：如果你点击了推荐积木 -> 听积木的并自动同步下拉框
            const blockRoom = ROOMS.find(r => String(r.id) === String(window.selectedRoomIdManual));
            room = blockRoom;
       } else if (existingAppt && !isProjectChanged && existingAppt.start === timeVal) {
            // 优先级 3：编辑模式 + 项目内容没变 -> 锁死原房
            room = originalRoom;
        } else {
            // 优先级 4：全自动寻找最佳空档
            let bestRoom = null, minGap = 9999;
            const candidateRooms = isCouple ? ROOMS.filter(r => r.id === 5) : ROOMS.filter(r => r.type === 'single' || r.id === 5);
            
            candidateRooms.forEach(r => {
                if (!checkRoomConflict(r.id)) {
                    const lastAppt = appointments.filter(a => a.date === dateVal && String(a.room.id) === String(r.id) && timeToMin(a.roomEnd || a.end) <= roomStart)
                                                 .sort((a, b) => timeToMin(b.roomEnd || b.end) - timeToMin(a.roomEnd || a.end))[0];
                    let currentGap = 9999;
                    if (!lastAppt) {
                        const day = new Date(dateVal.replace(/-/g, "/")).getDay();
                        currentGap = roomStart - ((day === 0 || day === 6) ? 570 : 600);
                    } else {
                        currentGap = roomStart - timeToMin(lastAppt.roomEnd);
                    }
                    if (currentGap >= 0 && currentGap < minGap) { minGap = currentGap; bestRoom = r; }
                }
            });
            room = bestRoom;
        }

            if (!room) return alert("无可约房间！请调整时间。");
        }

        // 5. 技师忙碌校验
        const checkStaffBusy = (n) => appointments.some(a => {
            if (currentEditingId && String(a.id) === String(currentEditingId)) return false;
            if (a.date !== dateVal) return false;

            const staffList = Array.isArray(a.staff) ? a.staff : [a.staff];
            if (!staffList.includes(n)) return false;

            // 🚀 核心：这些计算必须在 some 内部，针对每一张单子 a 进行计算
            const aStartMin = timeToMin(a.start);
            const aEndMin = aStartMin + (a.duration || 60);
            
            const targetStart = startMin;
            const targetEnd = startMin + totalDur;

            // 只要时间有重叠，就返回 true (代表忙碌)
            return (targetStart < aEndMin && targetEnd > aStartMin);
        }); // 👈 这里闭合 some

        let sName1 = document.getElementById('staff-1').value;
        let sName2 = document.getElementById('staff-2').value;
        let staffToAssign = [];
        const isFacialSave = projectList.some(p => p.category === 'facial');

        if (sName1 === "AUTO") {
            const hideMale = document.getElementById('exclude-male')?.checked || false;

            // 1. 【实打实积分统计】直接找“专业会计”拿数据
            const staffStats = window.getRealSolidScores();

            // 2. 【过滤可用人选】找出此时段不忙且出勤的技师
            let avail = STAFF.filter(s => {
                if (attendance[s.name] === false) return false;
                if (hideMale && s.name === "Russell") return false;
                if (checkStaffBusy(s.name)) return false;
                // 🕐 班次检查：订单时间必须在技师上班时间内
                const shifts = window.staffShifts || {};
                if (shifts[s.name]) {
                    const shiftStart = timeToMin(shifts[s.name].start);
                    const shiftEnd = timeToMin(shifts[s.name].end);
                    if (startMin < shiftStart || (startMin + totalDur) > shiftEnd) return false;
                }
                return true;
            });

            if (isFacialSave) avail = avail.filter(s => ["Fei", "Tracy", "Cat"].includes(s.name));



            // 3. 【核心公平排序】当前这段等得久的优先；差距30分钟以内则积分少的优先
            avail.forEach(s => {
                const shifts = window.staffShifts || {};
                const openMin = timeToMin(CONFIG.getOpenTime(dateVal));
                const staffStartMin = shifts[s.name] ? timeToMin(shifts[s.name].start) : openMin;
                const sAppts = appointments.filter(a =>
                    a.date === dateVal && (Array.isArray(a.staff) ? a.staff : [a.staff]).includes(s.name)
                );
                const lastEnd = sAppts.length > 0
                    ? Math.max(...sAppts.map(a => timeToMin(a.start) + (a.duration || 60)))
                    : staffStartMin;
                s._currentWait = Math.max(0, startMin - lastEnd);
            });
            avail.sort((a, b) => {
                const waitDiff = (b._currentWait || 0) - (a._currentWait || 0);
                if (Math.abs(waitDiff) > 30) return waitDiff;
                return staffStats[a.name] - staffStats[b.name];
            });

            // 4. 【执行分配】
            if (isCouple) {
                if (avail.length < 2) return alert("可用技师不足 2 人！");
                staffToAssign = [avail[0], avail[1]];
            } else {
                if (avail.length < 1) return alert("无可用技师！");
                staffToAssign = [avail[0]];
            }
        } else {
            // 手动选择技师时的逻辑保持不变
            if (checkStaffBusy(sName1)) {
                if (!confirm(`${sName1} 在该时段已有预约，是否继续？`)) return;
            }
            const s1Obj = STAFF.find(s => s.name === sName1);
            if (s1Obj) staffToAssign.push(s1Obj);

            if (isCouple) {
                const sName2 = document.getElementById('staff-2')?.value || "AUTO";
                if (sName2 !== "AUTO" && sName2 !== "") {
                    if (sName1 === sName2) return alert("不能选同一个人！");
                    if (checkStaffBusy(sName2)) {
                        if (!confirm(`${sName2} 忙碌，是否继续？`)) return;
                    }
                    const s2Obj = STAFF.find(s => s.name === sName2);
                    if (s2Obj) staffToAssign.push(s2Obj);
                } else {
                    // 情侣单第二个为 AUTO 时，也按实打实积分补位
                    const staffStats = window.getRealSolidScores();
                    appointments.forEach(a => {
                        if (currentEditingId && String(a.id) === String(currentEditingId)) return;
                        if (a.date === dateVal) {
                            const sList = Array.isArray(a.staff) ? a.staff : [a.staff];
                            sList.forEach(n => { if(staffStats[n] !== undefined) staffStats[n] += (a.weight || 1.0); });
                        }
                    });
                    let others = STAFF.filter(s => s.name !== sName1 && attendance[s.name] !== false && !checkStaffBusy(s.name));
                    if (isFacialSave) others = others.filter(s => ["Fei", "Tracy", "Cat"].includes(s.name));
                    others.sort((a, b) => staffStats[a.name] - staffStats[b.name]);
                    if (others.length < 1) return alert("无可用技师补位！");
                    staffToAssign.push(others[0]);
                }
            }
        }

        // 6. 保存
       // --- 🚀 新增：获取“指定”状态并存入数据 ---
        const isRequest = document.getElementById('is-request')?.checked || false;

        // 🚀 第一步：在这里重新获取一次下拉框的原始字符串值
        const originalS1 = document.getElementById('staff-1').value;
        const originalS2 = document.getElementById('staff-2')?.value || "AUTO";

        // 🚀 核心逻辑：执行最新的阶梯积分规则
        // 🚀 核心逻辑：执行最新的“高差异化”阶梯积分规则
const apptWeight = Utils.calculateApptWeight(projectList, treatmentVal, needsRoom);

        // 🚀 第二步：修改 newEntry 对象 (约 144 行)
        const newEntry = {
            id: currentEditingId || (Date.now() + Math.random()),
            weight: apptWeight,
            customerName: customerName,
            date: dateVal, 
            start: timeVal, 
            end: minToTime(startMin + totalDur),
            duration: totalDur, 
            room: room, 
            staff: staffToAssign.map(s => s.name),
            isRequest: isRequest,
            excludeMale: document.getElementById('exclude-male')?.checked || false,
            treatment: treatmentVal,
            // 🚀 核心修复：存入“先做脚”或“先做身体”的状态
            comboOrder: document.getElementById('combo-order')?.value || "body-first", 
            savedStaff1: originalS1, 
            savedStaff2: isCouple ? originalS2 : "AUTO",
            type: (isCouple ? "👫 " : "") + allNames,
            roomStart: minToTime(roomStart), 
            roomEnd: minToTime(roomEnd),
            projectSnapshot: JSON.parse(JSON.stringify(projectList)),
            manualRoomLock: (document.getElementById('room-select')?.value !== "AUTO")
        };
        if (currentEditingId) {
            const idx = appointments.findIndex(a => String(a.id) === String(currentEditingId));
            if (idx !== -1) appointments[idx] = newEntry;
        } else {
            appointments.push(newEntry);
        }

        await Storage.save(dateVal, appointments, window.recalculateScores(), attendance);
        
        // 🚀 修复点：清理工作
        window.editingId = null; 
        window.selectedRoomIdManual = null; // 清理点击记录
        saveBtn.innerText = "保存预约"; 
        saveBtn.style.background = "#319795"; 
        window.currentSelectedProjects = [];
        // 🚀 新增：强制触发界面渲染，清空左侧绿色清单框
        if (typeof window.renderProjectList === 'function') {
            window.renderProjectList();
        }
         
        if(document.getElementById('is-request')) document.getElementById('is-request').checked = false;
        // 🚀 新增：保存后清空客人姓名输入框
        if(document.getElementById('customer-name')) {
            document.getElementById('customer-name').value = "";
        }
        
        // 🚀 核心新增：保存成功后清空时间框
        if (document.getElementById('book-time')) {
            document.getElementById('book-time').value = "";
        }

        // 🚀 核心新增：保存成功后取消“情侣模式”勾选，并隐藏第二个技师下拉框
        const coupleCheck = document.getElementById('couple-mode');
        if (coupleCheck) {
            coupleCheck.checked = false;
            // 别忘了把第二个技师的下拉框也藏起来
            const s2Sel = document.getElementById('staff-2');
            if (s2Sel) s2Sel.style.display = 'none';
        }
        // 🚀 核心新增：保存成功后取消“不要男技师”勾选
        const noMaleCheck = document.getElementById('exclude-male');
        if (noMaleCheck) {
            noMaleCheck.checked = false;
        }
        // 只有非 facial 项目才重置手法为 Sw
        if (document.getElementById('treatment-select') && !isFacialSave) {
            document.getElementById('treatment-select').value = "Sw";
        }
        renderAll();
        alert("保存成功！");
        window.selectedRoomIdManual = null;
    };
});
// --- 🚀 Square 批量导入逻辑 (强力时间解析 + 强制匹配版) ---
const importBtn = document.getElementById('import-btn');
// --- 🚀 重新整理的 Square 批量导入逻辑 ---
if (importBtn) {
    importBtn.onclick = async () => {
        const jsonStr = document.getElementById('import-json').value.trim();
        if (!jsonStr) return alert("请先贴入整理好的代码！");

        try {
            const newAppts = JSON.parse(jsonStr);
            const dateVal = document.getElementById('book-date').value;

            newAppts.forEach((item, index) => { 
                const startMin = timeToMin(item.start); 
                const rawName = item.projName.trim(); 

                // 1. 自主查表逻辑：匹配项目
                // --- 🚀 修改 A：支持拆分匹配 ---
                let finalProjectSnapshot = [];
                let totalCurrentFootDur = 0;
                let foundCat = 'body'; 

                // 把名字按 "+" 拆开 (例如 "Body 60 + Foot 30")
                const parts = rawName.includes('+') ? rawName.split('+').map(p => p.trim()) : [rawName];

                parts.forEach(part => {
                    let partMatched = null;
                    for (const cat in SUB_ITEMS) {
                        const found = SUB_ITEMS[cat].find(p => {
                            const numMatch = part.match(/\d+/);
                            const inputDur = numMatch ? parseInt(numMatch[0]) : null;
                            if (inputDur !== null) {
                                return (part.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(part.toLowerCase()));
                            }
                            return part === p.name || part.includes(p.name) || p.name.includes(part);
                        });
                        if (found) { 
                            partMatched = found; 
                            if (cat !== 'foot') foundCat = cat; // 只要有一项不是足疗，主分类就跟着它走
                            break; 
                        }
                    }

                    if (partMatched) {
                        finalProjectSnapshot.push({
                            name: partMatched.name, dur: partMatched.dur,
                            category: partMatched.category, footDur: partMatched.footDur || 0
                        });
                        totalCurrentFootDur += (partMatched.footDur || 0);
                    }
                });
                // 2. 基础数据计算 (使用拆分后的新清单)
const duration = finalProjectSnapshot.length > 0 ? 
                 finalProjectSnapshot.reduce((sum, p) => sum + p.dur, 0) : 
                 (parseInt(item.duration) || 60);

const currentFootDur = totalCurrentFootDur; // 直接使用你刚才累加好的总洗脚时长
// 🚀 核心修复：必须先定义 isBlock，判定项目名是否包含 'block'
const isBlock = rawName.toLowerCase().includes('block'); 

const isCouple = item.isCouple === true || rawName.includes('👫'); 
const needsRoom = foundCat !== 'foot' && !isBlock; // 现在 isBlock 有定义了
                // 🚀 核心逻辑 A：对上号识别执行顺序
let autoOrder = "";

                const finalCat = (needsRoom && currentFootDur > 0) ? 'combo' : (isBlock ? 'block' : foundCat);
                const finalTreatment = (finalCat === 'facial' || finalCat === 'foot' || isBlock) ? "" : "Sw";

                // 🚀 核心逻辑 B：同步计算房间起止时间
                let calcRoomStartMin = startMin;
                if (autoOrder === "foot-first") calcRoomStartMin = startMin + currentFootDur;
                
                const bodyDur = duration - currentFootDur;
                const calcRoomEndMin = calcRoomStartMin + bodyDur + (CONFIG.CLEAN_TIME || 10);

                // 3. 生成 entry 对象
// ✨ 核心修复：在这里加一个“保底网”，防止项目清单变空
let finalSnap = finalProjectSnapshot.length > 0 ? finalProjectSnapshot : [{
    name: item.projName || "未知项目", 
    dur: duration, 
    category: foundCat || "body", 
    footDur: totalCurrentFootDur || 0
}];

const entry = {
    id: (Date.now() + index + Math.random()).toString(),
    customerName: isBlock ? "🚫 房锁" : (item.customerName.split('&')[0].split('(')[0].trim() || "Square客"),
    date: dateVal,
    start: item.start,
    end: minToTime(startMin + duration),
    duration: duration,
    staff: isBlock ? [] : ["AUTO"],
    room: { id: 0, name: "待分配" },
    isCouple: isCouple,
    treatment: finalTreatment,
    comboOrder: autoOrder,
    roomStart: minToTime(calcRoomStartMin),
    roomEnd: minToTime(calcRoomEndMin),
    // 🚀 这里改用我们刚才算好的 finalSnap
    projectSnapshot: finalSnap, 
    
    // 🚀 下面的 weight 计算也要跟着改，用 finalSnap
    weight: isBlock ? 0 : Utils.calculateApptWeight(
        finalSnap,
        finalTreatment, 
        needsRoom
    ),
    savedStaff2: isCouple ? "AUTO" : "AUTO",
    type: (isCouple ? "👫 " : "") + rawName, 
    isRequest: false
    };

                // 4. 执行存入
                appointments.push(entry);
            });

            // 5. 保存并渲染
            await Storage.save(dateVal, appointments, window.recalculateScores(), attendance);
            if (typeof renderAll === 'function') renderAll();
            document.getElementById('import-json').value = "";
            alert("导入成功！");
        } catch (e) {
            console.error(e);
            alert("导入失败，格式有误。");
        }
    };
}

// 🚀 核心修复：将一键分房移出导入按钮的 onclick 范围
window.autoAssignRooms = async () => {
    if (typeof window.getSelectedOrderIds !== 'function') return alert("系统错误：无法获取勾选工具");
    const selectedIds = window.getSelectedOrderIds();

    if (selectedIds.length === 0) return alert("请先在右侧列表中【勾选】订单！");

    const dateVal = document.getElementById('book-date').value;
    // 🚀 核心改进：只要是选中的单子，不管分没分过，都允许重新分配
    const targets = window.appointments.filter(a => selectedIds.includes(String(a.id)));
    
    if (targets.length === 0) return alert("选中的订单已经分过房了。");

    // 🚀 核心修复：直接使用 data.js 里的 timeToMin，它能看懂 18:05
    targets.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));

        targets.forEach(appt => {
            // 🚀 核心修复：足疗单直接标记为 Lobby 并跳过后续所有分房计算
            const needsRoom = appt.projectSnapshot && appt.projectSnapshot.some(p => p.category !== 'foot');
            if (!needsRoom) {
    // 🚀 核心修复：即使是大厅单，也要把进出时间同步了再退出
    appt.room = { id: 0, name: "Lobby" };
    appt.roomStart = appt.start; // 进大厅时间即开始时间
    appt.roomEnd = appt.end;     // 出大厅时间即结束时间
    return; 
}
        // 1. 计算该订单的脚部总时长 (与手动保存逻辑一致)
        const totalFootDur = appt.projectSnapshot.reduce((sum, p) => {
            if (p.category === 'foot') return sum + p.dur;
            return sum + (p.footDur || 0);
        }, 0);

        // 2. 算出精准的进房/退房分钟数 (分钟)
        const startMin = timeToMin(appt.start);
        let calcRoomStartMin = startMin;
        // 如果设置为先洗脚，房间开始时间要往后推
        if (appt.comboOrder === 'foot-first') calcRoomStartMin = startMin + totalFootDur;

        const actualRoomProjectDur = (appt.duration || 60) - totalFootDur;
        // 退房时间 = 进房时间 + 身体/面部项目时长 + 10分钟清理
        let calcRoomEndMin = calcRoomStartMin + actualRoomProjectDur + (CONFIG.CLEAN_TIME || 10);

        // 3. 使用这两个精准时间去跑冲突检测和找房
        const sMin = calcRoomStartMin;
        const eMin = calcRoomEndMin;
        const isCouple = (appt.type || "").includes("👫");
        const candidateRooms = isCouple ? ROOMS.filter(r => r.id === 5) : ROOMS.filter(r => r.type === 'single' || r.id === 5);

        // 🚀 核心改进：引入惩罚分制度，保护黄金大块时间
        let bestRoom = null, minScore = 9999; 

        candidateRooms.forEach(r => {
            const hasConflict = window.appointments.some(a => 
                a.date === dateVal && String(a.room.id) === String(r.id) && 
                String(a.id) !== String(appt.id) &&
                (sMin < timeToMin(a.roomEnd || a.end) && eMin > timeToMin(a.roomStart || a.start))
            );

            if (!hasConflict) {
                const dayAppts = window.appointments.filter(a => a.date === dateVal && String(a.room.id) === String(r.id) && timeToMin(a.roomEnd || a.end) <= sMin);
                const lastAppt = dayAppts.sort((a, b) => timeToMin(b.roomEnd || b.end) - timeToMin(a.roomEnd || a.end))[0];
                const day = new Date(dateVal.replace(/-/g, "/")).getDay();
                const openMin = timeToMin(CONFIG.getOpenTime(dateVal));
                let currentGap = lastAppt ? (sMin - timeToMin(lastAppt.roomEnd || lastAppt.end)) : (sMin - openMin);

                // --- 🚀 黄金保护逻辑开始 ---
                let penalty = 0;
                // 定义黄金倍数：0, 70, 140, 200, 210, 280, 300...
                const isPerfectGap = (currentGap === 0) || (currentGap > 0 && (currentGap % 70 === 0 || currentGap % 100 === 0));

                if (isPerfectGap) {
                    penalty = -500; // 🌟 黄金对齐：大幅加分（分数越低优先级越高）
                } else if (currentGap > 0 && currentGap < 70) {
                    penalty = 2000; // 🛑 尴尬碎片：如果你占了房后导致前面只剩不到70分钟，重罚！
                }

                // 如果是空房间，额外给一点“开新房”奖励，避免大家全挤在 Room 1 后面把时间切碎
                if (!lastAppt) penalty -= 100; 
                if (!isCouple && String(r.id) === "5") penalty += 1000; 

                let finalScore = currentGap + penalty;

                if (finalScore < minScore) { 
                    minScore = finalScore; 
                    bestRoom = r; 
                }
                // --- 🚀 逻辑结束 ---
            }
        });

        // 4. 执行最终分配
        if (bestRoom) {
            appt.room = { id: parseInt(bestRoom.id), name: bestRoom.name };
            // 🚀 核心修复：将刚才算好的精准进出房时间写回订单，确保看板不跳变
            appt.roomStart = minToTime(calcRoomStartMin);
            appt.roomEnd = minToTime(calcRoomEndMin);
        }
    });

    await Storage.save(dateVal, window.appointments, window.recalculateScores(), window.attendance);
    setTimeout(() => { if (typeof renderAll === 'function') renderAll(); }, 50);
    alert(`成功分配了房间！`);
};