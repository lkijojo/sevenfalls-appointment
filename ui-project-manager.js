/**
 * js/ui-project-manager.js - 负责项目清单管理与订单编辑/删除
 */

window.currentSelectedProjects = []; 

window.updateSubItems = function() {
    const mainCat = document.getElementById('main-category').value;
    const subSelect = document.getElementById('sub-item-select');
    const treatSelect = document.getElementById('treatment-select');
    if (!subSelect) return;
    if (mainCat === 'facial' && treatSelect) treatSelect.value = ""; 
    const treatGroup = document.getElementById('treatment-group');
    if (treatGroup) treatGroup.style.display = (mainCat === 'body' || mainCat === 'combo') ? 'block' : 'none';
    subSelect.innerHTML = "";
    (SUB_ITEMS[mainCat] || []).forEach((it, index) => {
        const opt = document.createElement('option');
        opt.value = index; opt.textContent = `${it.name} (${it.dur}m)`;
        opt.setAttribute('data-dur', it.dur);
        opt.setAttribute('data-foot', it.footDur || 0); 
        subSelect.appendChild(opt);
    });
}; 

window.addProjectToList = function() {
    const cat = document.getElementById('main-category').value;
    const subSelect = document.getElementById('sub-item-select');
    const treatSelect = document.getElementById('treatment-select');
    const treat = (cat === 'body' || cat === 'combo') ? (treatSelect ? treatSelect.value : "") : "";
    if (!cat || subSelect.selectedIndex < 0) return alert("请先选择大类和规格");
    const proj = SUB_ITEMS[cat][subSelect.selectedIndex];
    window.currentSelectedProjects.push({ name: proj.name, dur: proj.dur, footDur: proj.footDur || 0, category: cat, treatment: treat });
    window.renderProjectList();
    if (document.getElementById('book-date').value) window.showSuggestions(document.getElementById('book-date').value);
};

window.renderProjectList = function() {
    const cont = document.getElementById('project-items-container');
    const listD = document.getElementById('selected-projects-list');
    const totalD = document.getElementById('total-duration-display');
    const orderW = document.getElementById('combo-order-wrapper');
    const projects = window.currentSelectedProjects;
    if (projects.length === 0) {
        listD.style.display = 'none'; if (orderW) orderW.style.display = 'none'; return;
    }
    listD.style.display = 'block';
    // 🚀 核心改进：只要存在“占房项目”和“涉及脚的项目”，就显示执行顺序
    const hasRoomProject = projects.some(p => p.category === 'body' || p.category === 'facial' || p.category === 'combo');
    const hasFootUsage = projects.some(p => p.category === 'foot' || (p.footDur && p.footDur > 0));


    if (orderW) {
        const isShown = (hasRoomProject && hasFootUsage);
        orderW.style.display = isShown ? 'block' : 'none';

        const comboOrderSel = document.getElementById('combo-order');
        // 🚀 核心新增：监听下拉框手动切换，实现时间"解耦"
        if (isShown && comboOrderSel) {
            // 核心修复：每次都先移除旧的监听器再重新绑定，彻底避免重复触发
            const comboChangeHandler = () => {
                const timeInput = document.getElementById('book-time');
                if (!timeInput.value) return;

                // 1. 获取当前所有项目的洗脚总时长（直接读全局变量，始终是最新值）
                const footDur = window.currentSelectedProjects.reduce((sum, p) => sum + (p.footDur || 0), 0);
                if (footDur === 0) return;

                let currentMin = timeToMin(timeInput.value);
                
                // 🚀 核心反向逻辑：
                // 如果切到"先做脚"：客人到店时间提前 (减少 footDur)
                // 如果切到"先做身"：客人到店时间推后 (增加 footDur)
                const newMin = (comboOrderSel.value === 'foot-first') ? 
                              (currentMin - footDur) : (currentMin + footDur);

                timeInput.value = minToTime(newMin);

                // 2. 刷新积木推荐，保持选中状态同步
                const dateVal = document.getElementById('book-date').value;
                if (dateVal && typeof window.showSuggestions === 'function') {
                    window.showSuggestions(dateVal);
                }
            };
            // 先移除上一次绑定的同名函数（如果有），再重新绑定，防止重复触发
            if (comboOrderSel._comboChangeHandler) {
                comboOrderSel.removeEventListener('change', comboOrderSel._comboChangeHandler);
            }
            comboOrderSel._comboChangeHandler = comboChangeHandler;
            comboOrderSel.addEventListener('change', comboChangeHandler);
        }
    }
// --- 修复结束 ---
    cont.innerHTML = projects.map((p, index) => {
        const treatTag = p.treatment ? `<b style="color:#319795; margin-right:4px;">[${p.treatment}]</b>` : "";
        return `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; background: white; padding: 6px 10px; margin-bottom: 4px; border-radius: 4px; border: 1px solid #b2f5ea;">
            <span>${treatTag}${p.name} (${p.dur}m)</span>
            <span onclick="window.removeProject(${index})" style="color: #e53e3e; cursor: pointer; font-weight: bold; padding: 0 5px;">✕</span>
        </div>`;
    }).join('');
    totalD.innerText = `⌛ 总计时长: ${projects.reduce((sum, p) => sum + p.dur, 0)} 分钟`;
};

window.removeProject = function(index) {
    window.currentSelectedProjects.splice(index, 1);
    window.renderProjectList();
    if (document.getElementById('book-date').value) window.showSuggestions(document.getElementById('book-date').value);
};

window.deleteAppt = (id) => {
    if (confirm(`确定删除预约？`)) {
        const idx = appointments.findIndex(a => String(a.id) === String(id));
        if (idx !== -1) {
            const dateVal = appointments[idx].date;
            appointments.splice(idx, 1);
            Storage.save(dateVal, appointments, window.recalculateScores(), attendance);
            renderAll();
        }
    }
};

window.editAppt = (id) => {
    const tar = appointments.find(a => String(a.id) === String(id));
    if (!tar) return;
    window.editingId = tar.id;

    // 1. 基础信息回填
    const nameIn = document.getElementById('customer-name');
    if (nameIn) nameIn.value = tar.customerName || "";
    
    const saveB = document.getElementById('save-btn');
    if (saveB) { 
        saveB.innerText = "确认修改预约"; 
        saveB.style.background = "#D69E2E"; 
    }

    document.getElementById('book-date').value = tar.date;
    document.getElementById('book-time').value = tar.start;
    document.getElementById('treatment-select').value = tar.treatment || "Sw";
// 🚀 智能回显：只有【手动锁过】的房间才回传房号，否则显示“自动分配”
const roomSel = document.getElementById('room-select');
if (roomSel) {
    // 只有当标签明确为 true，且房号有效时，才回填下拉框
    if (tar.manualRoomLock === true && tar.room && tar.room.id !== 0) {
        roomSel.value = String(tar.room.id);
    } else {
        // 系统算的、批量导入的、或者没锁过的，通通显示“✨ 自动分配”
        roomSel.value = "AUTO";
    }
}
    // 2. 项目快照回填
    window.currentSelectedProjects = JSON.parse(JSON.stringify(tar.projectSnapshot || []));
    const comboOrderSel = document.getElementById('combo-order');
    // --- 🚀 修改后：支持回填“未选择”状态 ---
if (comboOrderSel) {
    // 如果 tar.comboOrder 有值就填入，如果是空字符串（导入对不上号的情况）就填入 ""
    // 这会自动匹配到 HTML 中 <option value="">未选择</option> 这一项
    comboOrderSel.value = tar.comboOrder || ""; 
}

    // 3. 大类和规格回填 (含 50ms 延迟确保下拉框生成)
    if (tar.projectSnapshot && tar.projectSnapshot.length > 0) {
        const firstProj = tar.projectSnapshot[0];
        const mainCatEl = document.getElementById('main-category');
        if (mainCatEl) {
            mainCatEl.value = firstProj.category;
            window.updateSubItems();
            setTimeout(() => {
                const subSelect = document.getElementById('sub-item-select');
                if (subSelect) {
                    for (let i = 0; i < subSelect.options.length; i++) {
                        if (subSelect.options[i].text.includes(firstProj.name)) {
                            subSelect.selectedIndex = i;
                            break;
                        }
                    }
                }
}, 120);
        }
    }
    
    window.renderProjectList();

    // 4. 核心状态回填 (情侣/指定/不要男)
    const cModeCheck = document.getElementById('couple-mode');
    const s1Sel = document.getElementById('staff-1');
    const s2Sel = document.getElementById('staff-2');
    const reqCheck = document.getElementById('is-request');
    const noMaleCheck = document.getElementById('exclude-male');

    // 判定是否勾选情侣模式：优先看存好的标签，没有则看技师人数
    const isCoupleMode = !!tar.isCouple || (Array.isArray(tar.staff) && tar.staff.length > 1);
    
    if (cModeCheck) cModeCheck.checked = isCoupleMode;
    if (s2Sel) s2Sel.style.display = isCoupleMode ? 'block' : 'none';
    if (noMaleCheck) noMaleCheck.checked = !!tar.excludeMale;
    if (reqCheck) reqCheck.checked = !!tar.isRequest;

    // 5. 技师名字回填逻辑
    const staffArray = Array.isArray(tar.staff) ? tar.staff : [tar.staff];
    const s1Value = tar.savedStaff1 || (tar.isRequest ? staffArray[0] : "AUTO");
    const s2Value = tar.savedStaff2 || (isCoupleMode && tar.isRequest ? staffArray[1] : "AUTO");

    if (s1Sel) {
        s1Sel.value = s1Value;
        // 暴力二次查重赋值
        if (s1Sel.value !== s1Value) s1Sel.value = s1Value;
    }

    if (s2Sel && isCoupleMode) {
        s2Sel.value = s2Value;
        if (s2Sel.value !== s2Value) s2Sel.value = s2Value;
    } else if (s2Sel) {
        s2Sel.value = "AUTO";
    }

    // 6. 渲染刷新 (必须在所有回填完成后)
    renderAll();

    // 7. 技师下拉框在 renderAll 之后再强制赋值一次，防止被重置
    setTimeout(() => {
        if (s1Sel) s1Sel.value = s1Value;
        if (s2Sel && isCoupleMode) s2Sel.value = s2Value;
    }, 50);

    // 8. 积木推荐联动
    if (tar.date && typeof window.showSuggestions === 'function') {
        window.showSuggestions(tar.date);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('couple-mode')?.addEventListener('change', (e) => {
    const s2 = document.getElementById('staff-2');
    if (s2) {
        s2.style.display = e.target.checked ? 'block' : 'none';
        if (!e.target.checked) s2.value = "AUTO";
    }

    // 🚀 插入这一段：确保勾选“情侣模式”时，下方的推荐积木立刻刷新为 Room 5
    const dateVal = document.getElementById('book-date').value;
    if (dateVal && typeof window.showSuggestions === 'function') {
        window.showSuggestions(dateVal);
    }
});
// 🚀 核心新增：点击页面空白处（非录入区），自动切回“新增模式”
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    // 判定是否点击了编辑按钮 📝
    const isEditBtn = e.target.closest('button') && e.target.innerText.includes('📝');
    
    // ✨ 核心白名单：点击以下区域【禁止】重置编辑模式
    const isNoMaleCheck = e.target.id === 'exclude-male' || e.target.closest('label')?.innerText.includes('不要男');
    const isAttendance = e.target.closest('#attendance-toggles');
    const isRoomBoard = e.target.closest('#room-board') || e.target.closest('#staff-busy-board'); 
    const isSuggestList = e.target.closest('#smart-suggestions') || e.target.closest('.suggest-item'); // 🚀 确保包含积木本身
    const isSaveBtn = e.target.id === 'save-btn'; // 🚀 确保包含保存按钮

    // 逻辑判定：如果点击的不是侧边栏，也不是编辑按钮，且不在所有白名单内
    if (sidebar && !sidebar.contains(e.target) && !isEditBtn && !isNoMaleCheck && !isAttendance && !isRoomBoard && !isSuggestList && !isSaveBtn) {
        if (window.editingId) {
            window.resetToNewMode();
            console.log("点击空白处，已自动切回新增模式");
        }
    }
});

// 🚀 核心重置函数：把左边全部清空，变回加新单模式
window.resetToNewMode = () => {
    window.editingId = null; 
    
    // 1. 按钮变回绿色“保存预约”
    const saveB = document.getElementById('save-btn');
    if (saveB) {
        saveB.innerText = "保存预约";
        saveB.style.background = "#319795";
    }

    // 2. 清空所有输入框和勾选状态
    const fields = ['customer-name', 'book-time', 'is-request', 'exclude-male', 'couple-mode'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') el.checked = false;
            else el.value = "";
        }
    });
    // 🚀 核心新增：重置房间下拉框为“自动分配”
    const roomSel = document.getElementById('room-select');
    if (roomSel) {
        roomSel.value = "AUTO";
    }
    // 🚀 核心新增：重置项目执行顺序为“未选择”
    const comboOrderSel = document.getElementById('combo-order');
    if (comboOrderSel) {
        comboOrderSel.value = ""; 
    }
    // 3. 隐藏第二个技师框 (针对情侣模式重置)
    const s2 = document.getElementById('staff-2');
    if (s2) s2.style.display = 'none';

    // 4. 清空已选项目清单并刷新界面
    window.currentSelectedProjects = [];
    if (typeof window.renderProjectList === 'function') window.renderProjectList();
    if (typeof renderAll === 'function') renderAll();
    
    console.log("检测到点击外部，已切回新增模式");
};
/**
 * 🚀 核心功能：批量删除所有被勾选的订单
 */
window.deleteSelectedAppts = () => {
    // 1. 获取所有打钩的订单 ID (调用 ui-render.js 里的工具)
    if (typeof window.getSelectedOrderIds !== 'function') {
        return alert("系统错误：无法获取勾选状态，请检查 ui-render.js");
    }
    
    const selectedIds = window.getSelectedOrderIds();

    if (selectedIds.length === 0) {
        return alert("请先在右侧订单列表中勾选要删除的单子！");
    }

    // 2. 二次确认
    if (!confirm(`确定要删除这 ${selectedIds.length} 个勾选的订单吗？`)) {
        return;
    }

    // 3. 执行过滤逻辑
    const dateVal = document.getElementById('book-date').value;
    
   // 🚀 核心修复 1：确保更新的是全局 appointments 数组
    window.appointments = window.appointments.filter(a => !selectedIds.includes(String(a.id)));

    // 🚀 核心修复 2：保存时必须传入更新后的 appointments
    const scores = typeof window.recalculateScores === 'function' ? window.recalculateScores() : {};
    Storage.save(dateVal, appointments, scores, attendance);
    
    // 5. 如果正在编辑的那个单子恰好被删了，强制重置左侧面板
    if (selectedIds.includes(String(window.editingId))) {
        window.resetToNewMode();
    }

    // 6. 刷新界面
    renderAll();
    alert(`成功删除 ${selectedIds.length} 个订单！`);
};
/**
 * 🚀 核心功能：公平重新分配勾选的订单
 */
window.reassignSelectedAppts = () => {
    // 🚀 核心修复：增加容错判断，确保能拿到日期
    const dateEl = document.getElementById('book-date');
    if (!dateEl) return alert("系统错误：找不到日期选择框");
    let dateVal = dateEl.value; 

    // 1. 获取选中的 ID
    const selectedIds = window.getSelectedOrderIds();
    if (selectedIds.length === 0) return alert("请先勾选需要重新分配的订单（通常是尚未开始的订单）");

    // 2. 筛选出真正需要重分的：已勾选 且 不是指定单 且 还没开始或正在进行中的单子不动
    const todayLocal = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })();
    const nowMinLocal = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); })();
    const targets = appointments.filter(a => {
        if (!selectedIds.includes(String(a.id))) return false;
        if (a.isRequest) return false;
        // 今天的单子：已开始（进行中或已结束）的不动
        if (a.date === todayLocal) {
            const aStartMin = timeToMin(a.start);
            if (nowMinLocal >= aStartMin) return false;
        }
        return true;
    });
    if (targets.length === 0) return alert("选中的订单中没有可重新分配的（可能全是指定单或已开始的单子）");

    if (!confirm(`将对 ${targets.length} 个非指定订单进行公平分配。系统将参考已完成订单的积分，并检测是否避开男技师，是否继续？`)) return;

    // 3. 获取当前的“实打实”积分（未勾选的和指定的）
    let currentScores = window.getRealSolidScores();
    const availableStaff = STAFF.filter(s => attendance[s.name] !== false);

    targets.forEach(appt => {
            // 💡 核心修复：直接在这里判定技师是否忙碌
            let candidates = availableStaff.filter(s => {
                const skillOk = window.isStaffQualified(s.name, appt);
                const genderOk = appt.excludeMale ? s.name !== "Russell" : true;
                
                // 🚀 这里的逻辑取代了 checkStaffBusy
                const isBusy = appointments.some(a => {
                    if (String(a.id) === String(appt.id)) return false;
                    if (a.date !== dateVal || !a.staff.includes(s.name)) return false;
                    const aStart = timeToMin(a.start);
                    const aEnd = aStart + (a.duration || 60);
                    const tStart = timeToMin(appt.start);
                    const tEnd = tStart + (appt.duration || 60);
                    return (tStart < aEnd && tEnd > aStart);
                });

                if (skillOk && genderOk && !isBusy) {
                    // 下面的计算最后结束时间逻辑保持不变
                    const staffAppts = appointments.filter(a => a.date === dateVal && a.staff.includes(s.name));
                    s.lastEndMin = staffAppts.length > 0 ? 
                        timeToMin(staffAppts.sort((m, n) => timeToMin(n.end) - timeToMin(m.end))[0].end) : 0;
                    return true;
                }
                return false;
            });
        
        // 遵守“不要男”限制
        if (appt.excludeMale) {
            candidates = candidates.filter(s => s.name !== "Russell");
        }

        if (candidates.length > 0) {
            // 🚀 1. 核心修复：判定该订单原本需要几个技师
            // 根据 type 里是否含 👫 图标，或者原本 staff 数组的长度来判断
            const isCoupleAppt = appt.type.includes("👫") || (appt.staff && appt.staff.length > 1);
            const neededCount = isCoupleAppt ? 2 : 1;

            if (candidates.length >= neededCount) {
                // 核心排序：当前这段等得久的优先；差距30分钟以内则积分少优先；都一样则随机
                const apptStartMin = timeToMin(appt.start);
                const openMin = timeToMin(CONFIG.getOpenTime(dateVal));
                const shifts = window.staffShifts || {};
                candidates.forEach(s => {
                    const staffStartMin = shifts[s.name] ? timeToMin(shifts[s.name].start) : openMin;
                    const sAppts = appointments.filter(a =>
                        a.date === dateVal && (Array.isArray(a.staff) ? a.staff : [a.staff]).includes(s.name)
                    );
                    const lastEnd = sAppts.length > 0
                        ? Math.max(...sAppts.map(a => timeToMin(a.start) + (a.duration || 60)))
                        : staffStartMin;
                    s._currentWait = Math.max(0, apptStartMin - lastEnd);
                });
                candidates.sort((a, b) => {
                    const waitDiff = (b._currentWait || 0) - (a._currentWait || 0);
                    if (Math.abs(waitDiff) > 30) return waitDiff;
                    const scoreDiff = currentScores[a.name] - currentScores[b.name];
                    if (scoreDiff !== 0) return scoreDiff;
                    return Math.random() - 0.5;
                });

                
                // 3. 选出分数最低的前 N 个人
                const selectedStaff = candidates.slice(0, neededCount);

                // 4. 执行分配：存入名字数组
                appt.staff = selectedStaff.map(s => s.name);
                
                // 🚀 5. 关键改进：累加该订单的真实阶梯权重 (weight)，而不仅仅是 +1
                selectedStaff.forEach(s => {
                    currentScores[s.name] += (appt.weight || 1.0);
                });
            }
        }
    });

    // 5. 最终保存并刷新
    const finalScores = typeof window.recalculateScores === 'function' ? window.recalculateScores() : currentScores;
    Storage.save(dateVal, appointments, finalScores, attendance);
    

    renderAll();

    // 1. 核心修复：根据备份的 ID 重新勾选
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        const id = cb.getAttribute('data-id');
        if (selectedIds.includes(String(id))) {
            cb.checked = true;
            // 还原行高亮颜色，保持视觉一致
            const row = cb.closest('tr');
            if (row) row.style.background = 'rgba(49, 130, 206, 0.02)';
        }
    });

    // 2. 检查并还原“全选”框的状态
    const checkAll = document.getElementById('check-all');
    if (checkAll) {
        // 如果勾选的数量等于当前显示的订单数量，自动把头部的全选钩子打上
        checkAll.checked = (selectedIds.length > 0 && selectedIds.length === checkboxes.length);
    }

    alert("公平分配完成！已为您保留原有的勾选状态。");
};

// 🚀 核心修复：监听勾选框，实现推荐积木“实时刷新”
document.addEventListener('DOMContentLoaded', () => {
    const noMaleCheck = document.getElementById('exclude-male');
    const coupleCheck = document.getElementById('couple-mode');
    const dateIn = document.getElementById('book-date');

    // 定义一个通用的刷新函数
    const refreshItems = () => {
        const dateVal = dateIn.value;
        if (dateVal && typeof window.showSuggestions === 'function') {
            console.log("检测到勾选变动，正在实时刷新推荐积木...");
            window.showSuggestions(dateVal);
        }
    };

    // 1. 只要“不要男技师”状态变了，立刻重刷
    if (noMaleCheck) {
        noMaleCheck.addEventListener('change', refreshItems);
    }

    // 2. 只要“情侣模式”状态变了，立刻重刷
    if (coupleCheck) {
        coupleCheck.addEventListener('change', refreshItems);
    }
});