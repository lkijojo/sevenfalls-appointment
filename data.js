/** * js/data.js - Irvine Harmony SPA 全项目与基础配置定义
 */
/**
 * 🚀 全局配置总开关
 */
const CONFIG = {
    CLEAN_TIME: 10,           // 房间打扫/消毒时间 (分钟)
    WEEKDAY_OPEN: "10:00",    // 周一至周五开门时间
    WEEKDAY_CLOSE: "20:00",   // 周一至周五关门时间
    WEEKEND_OPEN: "09:30",    // 周末开门时间
    WEEKEND_CLOSE: "21:00",   // 周末关门时间
    // 🚀 根据日期自动返回当天的开门/关门时间
    getOpenTime: (dateStr) => {
        const day = new Date(dateStr.replace(/-/g, "/")).getDay();
        return (day === 0 || day === 6) ? "09:30" : "10:00";
    },
    getCloseTime: (dateStr) => {
        const day = new Date(dateStr.replace(/-/g, "/")).getDay();
        return (day === 0 || day === 6) ? "21:00" : "20:00";
    }
};

// 1. 技师列表 (11位固定技师)
const STAFF = [
    { name: "Ivy", score: 0 }, { name: "Tracy", score: 0 }, { name: "Mia", score: 0 },
    { name: "Jessie", score: 0 }, { name: "Vanessa", score: 0 }, { name: "Coco", score: 0 },
    { name: "Michelle", score: 0 }, { name: "Cat", score: 0 }, { name: "Helen", score: 0 },
    { name: "Fei", score: 0 }, { name: "Russell", score: 0 }, { name: "Eva", score: 0 }
];

// 2. 房间列表 (Room 1-4 为单人，Room 5 为情侣/通用)
const ROOMS = [
    { id: 1, name: "Room 1", type: "single" }, 
    { id: 2, name: "Room 2", type: "single" },
    { id: 3, name: "Room 3", type: "single" }, 
    { id: 4, name: "Room 4", type: "single" },
    { id: 5, name: "Room 5 (Couple)", type: "couple" } 
];

// 3. 项目数据库 (严格匹配你的最新清单)
const SUB_ITEMS = {
    // 【1. 身体项目】 占房 + 10m 清洁
    body: [
        { name: "Body 30", dur: 30, category: "body" },
        { name: "Body 60", dur: 60, category: "body" },
        { name: "Body 90", dur: 90, category: "body" },
        { name: "Detox", dur: 80, category: "body" },
        { name: "Springtime Retreat", dur: 80, category: "body" }
    ],

    // 【2. 脸部项目】 占房 + 10m 清洁
    facial: [
        { name: "Acne", dur: 60, category: "facial" },
        { name: "Signature", dur: 60, category: "facial" },
        { name: "Botinol", dur: 60, category: "facial" },
        { name: "Sea C", dur: 60, category: "facial" },
        { name: "Hydrolifting", dur: 60, category: "facial" },
        { name: "HydraFacial", dur: 60, category: "facial" },
        { name: "Collagen", dur: 70, category: "facial" },
        { name: "Fresh Blast", dur: 30, category: "facial" }
    ],

    // 【3. 混合项目】 
    combo: [

        { name: "SP", dur: 90, footDur: 30, category: "combo" },

        { name: "Body Revive", dur: 90, footDur: 30, category: "combo" },

        { name: "Spring Renewal", dur: 90, footDur: 30, category: "combo" }
    ],

    // 【4. 足疗项目】 不占房
    foot: [
        // 🚀 核心修复：手动补齐 footDur，值通常与 dur 一致
        { name: "Foot 30", dur: 30, footDur: 30, category: "foot" },
        { name: "Foot 60", dur: 60, footDur: 60, category: "foot" },
        { name: "Foot fs", dur: 60, footDur: 60, category: "foot" }
    ]
};

// 4. 时间转换核心工具函数
const timeToMin = (t) => { 
    if(!t || typeof t !== 'string') return 0; 
    const [h, m] = t.split(':').map(Number); 
    return h * 60 + m; 
};

const minToTime = (m) => { 
    const h = Math.floor(m / 60); 
    const min = m % 60; 
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`; 
};

/**
 * 🚀 统一积分计算逻辑 - 严格匹配阶梯分值
 */
const Utils = {
    calculateApptWeight: (projectList, treatmentVal, needsRoom) => {
        let totalWeight = 0;
        
        projectList.forEach(p => {
            let pWeight = 0;
            const pDur = parseInt(p.dur) || 60;
            const pName = (p.name || "").toLowerCase(); 
            const pCat = p.category || (pName.includes('foot') ? 'foot' : 'body');

            if (pCat === 'foot') {
                pWeight = (pDur === 30) ? 0.5 : 1.0; // 30脚0.5，60脚1.0
            } 
            else if (pCat === 'body') {
                if (pName.includes('springtime')) pWeight = 2.5;
                else if (pDur === 30) pWeight = 1.5;
                else if (pDur === 60) pWeight = 2.0;
                else if (pDur === 90) pWeight = 3.0;
                else pWeight = 2.0; // 默认
            } 
            else if (pCat === 'facial') {
                pWeight = 2.0;
            } 
            else if (pCat === 'combo' || pName.includes('detox') || pName.includes('+')) {
                pWeight = 2.5;
            } 
            else {
                pWeight = 2.0;
            }
            totalWeight += pWeight;
        });

        // 手法加成：Deep Tissue 或 Target 额外 +0.5
        if ((treatmentVal === 'D' || treatmentVal === 'Target') && needsRoom) {
            totalWeight += 0.5;
        }
        return totalWeight;
    }
};