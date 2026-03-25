/**
 * js/ui-smart-logic.js - 核心算法：积木推荐与冲突检测
 */

window.showSuggestions = function(dateVal) {
    const goldenNumbers = [70, 100, 170, 240, 270, 310, 340, 370, 380, 410, 440, 450, 470, 480, 510, 520, 540, 550, 570, 580, 590, 610, 620, 640, 650, 660, 670, 680, 690, 710, 720, 730];
    const box = document.getElementById('smart-suggestions');
    const list = document.getElementById('suggest-list');
    if (!box || !list) return;
    box.style.display = 'block'; 
    list.innerHTML = ''; 

    const isFootFirst = document.getElementById('combo-order')?.value === 'foot-first';
    const hideMale = document.getElementById('exclude-male')?.checked;
    const isCouple = document.getElementById('couple-mode')?.checked;
    
    let totalDur = 0, footDur = 0;
    if (window.currentSelectedProjects && window.currentSelectedProjects.length > 0) {
        totalDur = window.currentSelectedProjects.reduce((sum, p) => sum + p.dur, 0);
        footDur = window.currentSelectedProjects.reduce((sum, p) => sum + (p.footDur || 0), 0);
    } else {
        const subSelect = document.getElementById('sub-item-select');
        const selectedOpt = subSelect ? subSelect.options[subSelect.selectedIndex] : null;
        totalDur = selectedOpt ? parseInt(selectedOpt.getAttribute('data-dur') || 60) : 60;
        footDur = selectedOpt ? parseInt(selectedOpt.getAttribute('data-foot') || 0) : 0;
    }

    const getFootUsage = (targetMin) => {
        let count = 0;
        appointments.forEach(a => {
            if (a.date !== dateVal || String(a.id) === String(window.editingId)) return;
            const start = timeToMin(a.start);
            const total = a.duration || 60;
            const end = start + total;
            if (a.mainCategory === 'foot') { if (targetMin >= start && targetMin < end) count++; } 
            else if (a.footDur && a.footDur > 0) {
                const fDur = parseInt(a.footDur);
                const isFF = a.comboOrder === 'foot-first';
                const fStart = isFF ? start : (end - fDur);
                const fEnd = isFF ? (start + fDur) : end;
                if (targetMin >= fStart && targetMin < fEnd) count++;
            }
        });
        return count;
    };

    const day = new Date(dateVal.replace(/-/g, "/")).getDay();
    const openMin = timeToMin(CONFIG.getOpenTime(dateVal));
    const needsRoom = window.currentSelectedProjects && window.currentSelectedProjects.length > 0 ? 
                      window.currentSelectedProjects.some(p => p.category !== 'foot') :
                      document.getElementById('main-category').value !== 'foot';

    let groupTargets = !needsRoom ? [{ id: 'foot-zone', name: '足疗区' }] : (isCouple ? ROOMS.filter(r => r.id === 5) : ROOMS);

    // --- 🚀 核心改进：在生成推荐积木前，对房间进行全局“可用性”排序 ---
    if (needsRoom) {
        groupTargets = [...groupTargets].sort((a, b) => {
            const getFirstAvailable = (roomId) => {
                const dayAppts = appointments.filter(appt => appt.date === dateVal && String(appt.room.id) === String(roomId))
                                             .sort((m1, m2) => timeToMin(m1.roomEnd) - timeToMin(m2.roomEnd));
                // 如果没活，开门即空；否则取最后一张单的结束时间
                if (dayAppts.length === 0) return openMin; 
                return timeToMin(dayAppts[dayAppts.length - 1].roomEnd);
            };
            return getFirstAvailable(a.id) - getFirstAvailable(b.id);
        });
    }

    groupTargets.forEach(roomOrZone => {
        const header = document.createElement('div');
        header.style = `grid-column: 1 / -1; background: ${!needsRoom ? '#F0FFF4' : '#EBF8FF'}; padding: 8px 12px; font-weight: bold; border-left: 4px solid ${!needsRoom ? '#38A169' : '#3182CE'}; margin: 12px 0 6px; font-size: 13px; border-radius: 4px; color: #2D3748;`;
        header.innerText = `🏠 ${roomOrZone.name}`;
        list.appendChild(header);

        const roomAppts = needsRoom ? appointments.filter(a => a.date === dateVal && String(a.room.id) === String(roomOrZone.id) && String(a.id) !== String(window.editingId)) : [];
        let roomTimes = [];
        if (!needsRoom) {
            let t = openMin; const closeMin = timeToMin(CONFIG.getCloseTime(dateVal)); while (t <= closeMin) { roomTimes.push(t); t += 30; }
        } else {
            let roomOrigins = [openMin];
            roomAppts.forEach(a => { if (!roomOrigins.includes(timeToMin(a.roomEnd))) roomOrigins.push(timeToMin(a.roomEnd)); });
            roomOrigins.forEach(origin => {
                // 🚀 核心修复：将你想要的黄金组合跨度 (170, 240, 270) 直接加入搜索步长
                [70, 100, 170, 240, 270, 310, 340, 370, 410, 440, 450].forEach(gapStep => {
                    let t = origin;
                    while (t <= timeToMin(CONFIG.getCloseTime(dateVal))) {
                        const nextB = roomAppts.filter(a => timeToMin(a.roomStart) >= t).sort((a, b) => timeToMin(a.roomStart) - timeToMin(b.roomStart))[0];
                        const nGap = nextB ? (timeToMin(nextB.roomStart) - t) : (1260 - t);
                        
                        let lastE = openMin;
                        roomAppts.forEach(a => { if(timeToMin(a.roomEnd) <= t && timeToMin(a.roomEnd) > lastE) lastE = timeToMin(a.roomEnd); });
                        const pGap = t - lastE;

                        // 只要这个点前后能塞下至少一个 70 分钟的项目，且不重复，就记录
                        if ((nGap === 0 || nGap >= 70) && (pGap === 0 || pGap >= 70) && !roomTimes.includes(t)) {
                            roomTimes.push(t);
                        }
                        t += gapStep; // 现在它会尝试按 170, 240, 270 的步长去“撞”黄金缝隙
                    }
                });
            });
        }

// --- 🚀 从第 104 行开始替换 ---
roomTimes.sort((a, b) => a - b).forEach(baseT => {
    // 1. 定义先身和先脚两种模式
    const modes = [
        { id: 'body-first', label: '💆先身', offset: 0 },
        { id: 'foot-first', label: '🦶先脚', offset: footDur }
    ];

    // 🚀 2. 获取下拉框当前选中的值 (来自 index.html)
    const comboOrderSel = document.getElementById('combo-order');
    const currentComboValue = comboOrderSel ? comboOrderSel.value : "";

    // 🚀 3. 核心动态过滤逻辑
    let activeModes = [];
    if (footDur > 0 && needsRoom) {
        if (currentComboValue === 'foot-first') {
            activeModes = [modes[1]]; // 手动选了先做脚，只显示先做脚
        } else if (currentComboValue === 'body-first') {
            activeModes = [modes[0]]; // 手动选了先做身，只显示先做身
        } else {
            activeModes = modes;      // “未选择”状态下，合并显示两种模式
        }
    } else {
        activeModes = [modes[0]];     // 纯身体或纯足疗项目，走默认模式
    }

            activeModes.forEach(mode => {
                // 计算客人到店时间 (displayMin)
                
                let displayMin = baseT - mode.offset;
                const startTimeText = minToTime(displayMin);
                if (displayMin < openMin) return;

                // 1. 过滤前后 2 小时 (可选)
                const userTimeVal = document.getElementById('book-time').value;
                if (userTimeVal && Math.abs(displayMin - timeToMin(userTimeVal)) > 120) return;

                // 2. 技师忙碌检测 (必须从 displayMin 开始算)
                const availStaffCount = STAFF.filter(s => {
                    if (attendance[s.name] === false || (hideMale && s.name === "Russell")) return false;
                    const isFacial = window.currentSelectedProjects.some(p => p.category === 'facial') || document.getElementById('main-category').value === 'facial';
                    if (isFacial && !["Fei", "Tracy", "Cat"].includes(s.name)) return false;
                    return !appointments.some(a => {
                        if (String(a.id) === String(window.editingId)) return false;
                        const sList = Array.isArray(a.staff) ? a.staff : [a.staff];
                        if (!sList.includes(s.name)) return false;
                        return (displayMin < (timeToMin(a.start) + (a.duration || 60)) && (displayMin + totalDur) > timeToMin(a.start));
                    });
                }).length;

                // 3. 房间忙碌检测 (使用 baseT 判定房间)
                const isRoomBusy = needsRoom ? roomAppts.some(a => {
                    const aRoomStart = timeToMin(a.roomStart);
                    const aRoomEnd = timeToMin(a.roomEnd);
                    return (baseT < aRoomEnd && (baseT + (totalDur - footDur)) > aRoomStart);
                }) : false;

                // 4. 大厅占用检测
                const targetFTime = (mode.id === 'foot-first') ? displayMin : (baseT + (totalDur - footDur));
                const curFUsage = getFootUsage(targetFTime);
                const isFFull = (footDur > 0) && (curFUsage >= 5);
                const isFull = isRoomBusy || (isCouple ? availStaffCount < 2 : availStaffCount < 1) || isFFull;

                // 🚀 换人腾位检测：递归连锁换人（最多3层）
                let swapPlan = null;
                if (isFull && !isRoomBusy && !isFFull) {
                    const isFacialCheck = window.currentSelectedProjects.some(p => p.category === 'facial') || document.getElementById('main-category').value === 'facial';
                    const neededCount = isCouple ? 2 : 1;
                    const shifts = window.staffShifts || {};

                    /**
                     * 在"虚拟换人"状态下判断 staffName 在 targetAppt 时段是否空闲
                     * virtualMap: Map<apptId, newStaffName> 记录本轮已虚拟替换的决定
                     */
                    const isStaffFreeAt = (staffName, targetAppt, virtualMap) => {
                        const tS = timeToMin(targetAppt.start);
                        const tE = tS + (targetAppt.duration || 60);
                        return !appointments.some(a => {
                            if (String(a.id) === String(targetAppt.id)) return false;
                            if (String(a.id) === String(window.editingId)) return false;
                            if (a.date !== dateVal) return false;
                            // 虚拟替换：保留原技师列表，只把被换掉的那个人替换成新人
                            const originalStaff = Array.isArray(a.staff) ? a.staff : [a.staff];
                            const swap = virtualMap.get(String(a.id));
                            const effectiveStaff = swap
                                ? originalStaff.map(n => n === swap.from ? swap.to : n)
                                : originalStaff;
                            if (!effectiveStaff.includes(staffName)) return false;
                            const aS = timeToMin(a.start);
                            const aE = aS + (a.duration || 60);
                            return (tS < aE && tE > aS);
                        });
                    };

                    /**
                     * 递归搜索：让 staffName 在 conflictAppt 时段空出来
                     * 返回 steps 数组（每步 {conflictAppt, fromStaff, toStaff}）或 null
                     */
                    const tryFree = (staffName, conflictAppt, virtualMap, depth, visitedIds) => {
                        if (depth > 3) return null;
                        const apptId = String(conflictAppt.id);
                        if (visitedIds.has(apptId)) return null;
                        if (conflictAppt.isRequest) return null; // 点名单不动

                        visitedIds.add(apptId);

                        // 找一个可以直接顶替的人（不需要再换）
                        const directAlt = STAFF.find(alt => {
                            if (alt.name === staffName) return false;
                            if (attendance[alt.name] === false) return false;
                            if (hideMale && alt.name === "Russell") return false;
                            if (!window.isStaffQualified(alt.name, conflictAppt)) return false;
                            if (shifts[alt.name]) {
                                const cs = timeToMin(shifts[alt.name].start);
                                const ce = timeToMin(shifts[alt.name].end);
                                const ca = timeToMin(conflictAppt.start);
                                const cb = ca + (conflictAppt.duration || 60);
                                if (ca < cs || cb > ce) return false;
                            }
                            // 在虚拟状态下此人是否空闲
                            return isStaffFreeAt(alt.name, conflictAppt, virtualMap);
                        });

                        if (directAlt) {
                            // 找到直接替换者，记录这步换人 {from, to}
                            virtualMap.set(apptId, { from: staffName, to: directAlt.name });
                            return [{ conflictAppt, fromStaff: staffName, toStaff: directAlt.name }];
                        }

                        // 没有直接替换者，尝试先把某个挡路的人的单再往外换（递归）
                        const altCandidates = STAFF.filter(alt => {
                            if (alt.name === staffName) return false;
                            if (attendance[alt.name] === false) return false;
                            if (hideMale && alt.name === "Russell") return false;
                            if (!window.isStaffQualified(alt.name, conflictAppt)) return false;
                            if (shifts[alt.name]) {
                                const cs = timeToMin(shifts[alt.name].start);
                                const ce = timeToMin(shifts[alt.name].end);
                                const ca = timeToMin(conflictAppt.start);
                                const cb = ca + (conflictAppt.duration || 60);
                                if (ca < cs || cb > ce) return false;
                            }
                            return true; // 技能/班次OK，但当前忙着
                        });

                        for (const alt of altCandidates) {
                            // 找 alt 在 conflictAppt 时段冲突的那张单
                            const altConflict = appointments.find(a => {
                                if (String(a.id) === String(conflictAppt.id)) return false;
                                if (String(a.id) === String(window.editingId)) return false;
                                if (a.date !== dateVal) return false;
                                if (a.isRequest) return false;
                                const origStaff = Array.isArray(a.staff) ? a.staff : [a.staff];
                                const altSwap = virtualMap.get(String(a.id));
                                const effectiveStaff = altSwap
                                    ? origStaff.map(n => n === altSwap.from ? altSwap.to : n)
                                    : origStaff;
                                if (!effectiveStaff.includes(alt.name)) return false;
                                const aS = timeToMin(a.start);
                                const aE = aS + (a.duration || 60);
                                const cS = timeToMin(conflictAppt.start);
                                const cE = cS + (conflictAppt.duration || 60);
                                return (cS < aE && cE > aS);
                            });
                            if (!altConflict) continue;

                            // 递归尝试把 alt 的冲突单再换出去
                            const subMap = new Map(virtualMap);
                            const subVisited = new Set(visitedIds);
                            const subSteps = tryFree(alt.name, altConflict, subMap, depth + 1, subVisited);
                            if (subSteps) {
                                // 子链成功，在子链的虚拟状态下 alt 已经空了，现在让 alt 来做 conflictAppt
                                subMap.set(apptId, { from: staffName, to: alt.name });
                                // 把子链结果合并回主 virtualMap
                                subMap.forEach((v, k) => virtualMap.set(k, v));
                                return [...subSteps, { conflictAppt, fromStaff: staffName, toStaff: alt.name }];
                            }
                        }

                        visitedIds.delete(apptId);
                        return null; // 无解
                    };

                    // 符合新单技能/班次要求的候选技师
                    const candidateStaff = STAFF.filter(s => {
                        if (attendance[s.name] === false) return false;
                        if (hideMale && s.name === "Russell") return false;
                        if (isFacialCheck && !["Fei", "Tracy", "Cat"].includes(s.name)) return false;
                        if (shifts[s.name]) {
                            const ss = timeToMin(shifts[s.name].start);
                            const se = timeToMin(shifts[s.name].end);
                            if (displayMin < ss || (displayMin + totalDur) > se) return false;
                        }
                        return true;
                    });

                    // 对每个候选，找其冲突单，尝试递归腾出来
                    let allSteps = [];
                    const masterVirtualMap = new Map();
                    let foundCount = 0;

                    for (const s of candidateStaff) {
                        if (foundCount >= neededCount) break;

                        // 在 masterVirtualMap 状态下，s 在新单时段是否已经空了
                        if (isStaffFreeAt(s.name, { start: minToTime(displayMin), duration: totalDur, id: '__new__' }, masterVirtualMap)) {
                            foundCount++;
                            continue; // 本来就空，不需要换
                        }

                        // 找 s 在 displayMin 时段的冲突单
                        const conflictAppt = appointments.find(a => {
                            if (String(a.id) === String(window.editingId)) return false;
                            if (a.date !== dateVal) return false;
                            if (a.isRequest) return false;
                            const effectiveStaff = masterVirtualMap.has(String(a.id))
                                ? [masterVirtualMap.get(String(a.id))]
                                : (Array.isArray(a.staff) ? a.staff : [a.staff]);
                            if (!effectiveStaff.includes(s.name)) return false;
                            return (displayMin < (timeToMin(a.start) + (a.duration || 60)) && (displayMin + totalDur) > timeToMin(a.start));
                        });
                        if (!conflictAppt) { foundCount++; continue; }

                        const steps = tryFree(s.name, conflictAppt, masterVirtualMap, 1, new Set());
                        if (steps) {
                            allSteps = [...allSteps, ...steps];
                            foundCount++;
                        }
                    }

                    // 双重验证：确保换人后真的凑够了 neededCount 个不冲突的技师
                    if (foundCount >= neededCount) {
                        // 用 masterVirtualMap 最终状态，再验一遍候选技师够不够
                        const verifiedCount = candidateStaff.filter(s => 
                            isStaffFreeAt(s.name, { start: minToTime(displayMin), duration: totalDur, id: '__new__' }, masterVirtualMap)
                        ).length;
                        if (verifiedCount >= neededCount) {
                            swapPlan = allSteps;
                        }
                    }
                }

                // 5. 渲染积木 UI
                let lastE = openMin;
                roomAppts.forEach(a => { if(timeToMin(a.roomEnd) <= baseT && timeToMin(a.roomEnd) > lastE) lastE = timeToMin(a.roomEnd); });
                const gap = baseT - lastE;
                const isGolden = goldenNumbers.includes(gap) || (gap > 0 && (gap % 70 === 0 || gap % 100 === 0));

                if (!isGolden && gap !== 0 && needsRoom) return;

                const isSwappable = isFull && !!swapPlan;
                const div = document.createElement('div');
                div.className = `suggest-item ${(isFull && !isSwappable) ? 'suggest-full' : ''}`;

                let label = '';
                if (isFull && !isSwappable) {
                    // 【红色】真的约不了
                    div.style.background = "#FFF5F5";
                    div.style.border = "1.5px solid #E53E3E";
                    label = `<div style="font-size: 9px; font-weight: bold; color: #E53E3E;">[🚫 满]</div>`;
                } else if (isSwappable) {
                    // 【紫色】换人后可约
                    div.style.background = "#FAF5FF";
                    div.style.border = "1.5px solid #805AD5";
                    const rawSwapNames = [...new Set(swapPlan.map(p => p.fromStaff))].join('/');
                    const swapNames = rawSwapNames.length > 12 ? rawSwapNames.slice(0, 12) + '…' : rawSwapNames;
                    label = `<div style="font-size: 9px; font-weight: bold; color: #805AD5;">[🔄 换${swapNames}]</div>`;
                } else if (needsRoom) {
                    const isGoldenGap = goldenNumbers.includes(gap);
                    const isMultiple = (gap > 0 && (gap % 70 === 0 || gap % 100 === 0));
                    if (gap === 0) {
                        div.style.background = "#FFFAF0";
                        div.style.border = "1.5px solid #DD6B20";
                        label = `<div style="font-size: 9px; font-weight: bold; color: #dd2020;">[🏠 接]</div>`;
                    } else if (isGoldenGap) {
                        div.style.background = "#EBF8FF";
                        div.style.border = "1.5px solid #3182CE";
                        label = `<div style="font-size: 9px; font-weight: bold; color: #3182CE;">[✨ ${gap}m]</div>`;
                    } else if (isMultiple) {
                        div.style.background = "#F0FFF4";
                        div.style.border = "1.5px solid #38A169";
                        label = `<div style="font-size: 9px; font-weight: bold; color: #38A169;">[✳️ ${gap}m]</div>`;
                    } else {
                        return;
                    }
                }

                const modeColor = (mode.id === 'foot-first') ? '#DD6B20' : '#805AD5';
                const modeTag = (footDur > 0 && needsRoom) ?
                    `<div style="color:${modeColor}; font-size:10px; margin-top:2px; font-weight:bold;">[${mode.label}]</div>` : "";

                div.innerHTML = `<b>${startTimeText}</b><small>${isFull && !isSwappable ? '' : '剩' + availStaffCount + '人'}</small><small style="line-height:1.2">${label}${modeTag}</small>`;

                if (!isFull || isSwappable) {
                    div.onclick = async () => {
                        if (isSwappable) {
                            const swapDesc = swapPlan.map(p =>
                                `将【${p.conflictAppt.customerName}】(${p.conflictAppt.start}) 的 ${p.fromStaff} → 换给 ${p.toStaff}`
                            ).join('\n');
                            if (!confirm(`需要调整以下安排才能约此时间：\n\n${swapDesc}\n\n确认后自动完成换人。`)) return;

                            const dateVal2 = document.getElementById('book-date').value;
                            swapPlan.forEach(p => {
                                const appt = window.appointments.find(a => String(a.id) === String(p.conflictAppt.id));
                                if (!appt) return;
                                const staffArr = Array.isArray(appt.staff) ? [...appt.staff] : [appt.staff];
                                const idx = staffArr.indexOf(p.fromStaff);
                                if (idx !== -1) staffArr[idx] = p.toStaff;
                                appt.staff = staffArr;
                                appt.savedStaff1 = staffArr[0] || 'AUTO';
                                appt.savedStaff2 = staffArr[1] || 'AUTO';
                            });
                            await Storage.save(dateVal2, window.appointments, window.recalculateScores(), window.attendance);
                        }

                        document.getElementById('book-time').value = startTimeText;
                        window.selectedRoomIdManual = null;
                        const comboOrderSel = document.getElementById('combo-order');
                        if (comboOrderSel && (footDur > 0 && needsRoom)) comboOrderSel.value = mode.id;
                        if (document.getElementById('staff-1')) document.getElementById('staff-1').value = "AUTO";
                        if (document.getElementById('staff-2')) document.getElementById('staff-2').value = "AUTO";
                        box.style.display = 'none';
                        if (window.renderProjectList) window.renderProjectList();
                        if (isSwappable) renderAll();
                    };
                }
                list.appendChild(div);
            });
        });
    });
};
// 🚀 核心新增：判定技师是否具备做某个订单的面部技能
window.isStaffQualified = function(staffName, appt) {
    const projects = appt.projectSnapshot || window.currentSelectedProjects || [];
    const isFacial = (appt.type || "").toLowerCase().includes('facial') || 
                     projects.some(p => p.category === 'facial' || (p.name && p.name.toLowerCase().includes('botinol')));

    if (isFacial) {
        return ["Fei", "Tracy", "Cat"].includes(staffName);
    }
    return true;
};

/**
 * 核心查表函数：供批量导入调用，识别特定时间点是否为黄金推荐位
 */
window.getRecommendationModes = function(startTime, footDur) {
    if (footDur <= 0) return [];

    // 1. 定义你的黄金时间表 (与积木逻辑保持绝对同步)
    const bodyFirstTimes = ["09:30", "11:10", "12:50", "14:30", "16:10", "17:50", "19:30"];
    const footFirstTimes = ["10:10", "11:50", "13:30", "15:10", "16:50", "18:30"];

    // 2. 判定该时间点属于哪种模式
    if (bodyFirstTimes.includes(startTime)) {
        return [{ id: 'body-first' }]; // 🚀 识别为：必须先做身
    } else if (footFirstTimes.includes(startTime)) {
        return [{ id: 'foot-first' }]; // 🚀 识别为：必须先做脚
    }

    // 3. 对不上号的时间返回空，交给导入逻辑去“按时长兜底”
    return [];
};
// 🚀 核心修复：保存时的房间冲突检测 (彻底解决“自己撞自己”的问题)
window.checkRoomAvailability = function(roomId, startMin, endMin, dateVal) {
    // 1. 先把别人找出来（排除正在编辑的自己）
    const otherAppts = appointments.filter(a => 
        a.date === dateVal && 
        String(a.room.id) === String(roomId) && 
        String(a.id) !== String(window.editingId) // 👈 这就是“放过自己”
    );

    // 2. 看看新时间有没有撞到别人
    for (let a of otherAppts) {
        const aStart = timeToMin(a.roomStart);
        const aEnd = timeToMin(a.roomEnd);
        
        // 核心：【新开始】<【旧结束】且【新结束】>【旧开始】就是撞了
        if (startMin < aEnd && endMin > aStart) {
            return false; 
        }
    }
    return true; // 没撞到别人，安全！
};