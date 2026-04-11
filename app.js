const STORAGE_KEY = "lesson-tracker-app-v1";
const weekdays = [
  { value: 0, label: "周日" },
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
];

const defaultAbsenceReasons = ["外出", "请假", "生病", "其他"];

const initialData = {
  classes: [
    { id: crypto.randomUUID(), name: "吴中A班", schedule: [2, 4, 6] },
    { id: crypto.randomUUID(), name: "吴中D班", schedule: [2, 4, 6] },
    { id: crypto.randomUUID(), name: "吴中E班", schedule: [2, 4, 6] },
    { id: crypto.randomUUID(), name: "吴中F班", schedule: [1, 3, 5] },
    { id: crypto.randomUUID(), name: "园区A班", schedule: [0, 3, 5] },
  ],
  students: [],
  attendance: [],
};

[
  ["吴中A班", ["Hannah", "Jason", "Cindy糖果", "Jeff", "Book", "Simon"]],
  ["吴中D班", ["Serena", "Amy", "Aiden", "Ricky", "Leo", "Lucky"]],
  ["吴中E班", ["Millie", "小猫", "Wade"]],
  ["吴中F班", ["Leo皮皮", "Ethan心心", "Eason li", "玥玥", "Iris"]],
  ["园区A班", ["Cindy", "汐汐", "Nina", "Yiyi", "QQ", "Mimi"]],
].forEach(([className, names]) => {
  const targetClass = initialData.classes.find((item) => item.name === className);
  names.forEach((name) => {
    initialData.students.push({
      id: crypto.randomUUID(),
      classId: targetClass.id,
      name,
      note: "",
      active: true,
      createdAt: new Date().toISOString(),
    });
  });
});

const state = loadState();
let selectedStudentId = null;
let deferredPrompt = null;

const elements = {
  installButton: document.querySelector("#installButton"),
  navButtons: [...document.querySelectorAll(".nav-button")],
  panels: [...document.querySelectorAll(".panel")],
  todayTitle: document.querySelector("#todayTitle"),
  todayScheduledCount: document.querySelector("#todayScheduledCount"),
  todayCompletedCount: document.querySelector("#todayCompletedCount"),
  todayList: document.querySelector("#todayList"),
  markAllPresentButton: document.querySelector("#markAllPresentButton"),
  resetTodayButton: document.querySelector("#resetTodayButton"),
  classSummary: document.querySelector("#classSummary"),
  studentDirectory: document.querySelector("#studentDirectory"),
  studentSearchInput: document.querySelector("#studentSearchInput"),
  recordsClassFilter: document.querySelector("#recordsClassFilter"),
  recordsStudentFilter: document.querySelector("#recordsStudentFilter"),
  recordsStartMonthInput: document.querySelector("#recordsStartMonthInput"),
  recordsEndMonthInput: document.querySelector("#recordsEndMonthInput"),
  recordsSummaryCards: document.querySelector("#recordsSummaryCards"),
  selectedStudentCard: document.querySelector("#selectedStudentCard"),
  reportClassFilter: document.querySelector("#reportClassFilter"),
  reportStudentFilter: document.querySelector("#reportStudentFilter"),
  reportStartMonthInput: document.querySelector("#reportStartMonthInput"),
  reportEndMonthInput: document.querySelector("#reportEndMonthInput"),
  monthlySummaryCards: document.querySelector("#monthlySummaryCards"),
  monthlyTableBody: document.querySelector("#monthlyTableBody"),
  exportMonthlyCsvButton: document.querySelector("#exportMonthlyCsvButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  importJsonInput: document.querySelector("#importJsonInput"),
  importCsvInput: document.querySelector("#importCsvInput"),
  addStudentButton: document.querySelector("#addStudentButton"),
  addClassButton: document.querySelector("#addClassButton"),
  studentDialog: document.querySelector("#studentDialog"),
  studentForm: document.querySelector("#studentForm"),
  studentDialogTitle: document.querySelector("#studentDialogTitle"),
  studentIdInput: document.querySelector("#studentIdInput"),
  studentNameInput: document.querySelector("#studentNameInput"),
  studentClassInput: document.querySelector("#studentClassInput"),
  studentNoteInput: document.querySelector("#studentNoteInput"),
  deleteStudentButton: document.querySelector("#deleteStudentButton"),
  closeStudentDialogButton: document.querySelector("#closeStudentDialogButton"),
  classDialog: document.querySelector("#classDialog"),
  classForm: document.querySelector("#classForm"),
  classDialogTitle: document.querySelector("#classDialogTitle"),
  classIdInput: document.querySelector("#classIdInput"),
  classNameInput: document.querySelector("#classNameInput"),
  weekdayCheckboxes: document.querySelector("#weekdayCheckboxes"),
  deleteClassButton: document.querySelector("#deleteClassButton"),
  closeClassDialogButton: document.querySelector("#closeClassDialogButton"),
  todayStudentTemplate: document.querySelector("#todayStudentTemplate"),
};

init();

function init() {
  registerServiceWorker();
  setupInstallPrompt();
  renderWeekdayOptions();
  bindEvents();
  setDefaultRangeInputs();
  renderAll();
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.target));
  });

  elements.markAllPresentButton.addEventListener("click", () => {
    getTodayStudents().forEach((student) => upsertAttendance(student.id, todayIso(), "present", ""));
    persistAndRender();
  });

  elements.resetTodayButton.addEventListener("click", () => {
    const today = todayIso();
    state.attendance = state.attendance.filter((record) => record.date !== today);
    persistAndRender();
  });

  elements.studentSearchInput.addEventListener("input", renderStudentsView);
  elements.recordsClassFilter.addEventListener("change", handleRecordsClassChange);
  elements.recordsStudentFilter.addEventListener("change", handleRecordsStudentChange);
  elements.recordsStartMonthInput.addEventListener("input", renderRecordsView);
  elements.recordsEndMonthInput.addEventListener("input", renderRecordsView);
  elements.reportClassFilter.addEventListener("change", handleReportsClassChange);
  elements.reportStudentFilter.addEventListener("change", renderReportsView);
  elements.reportStartMonthInput.addEventListener("input", renderReportsView);
  elements.reportEndMonthInput.addEventListener("input", renderReportsView);
  elements.exportMonthlyCsvButton.addEventListener("click", exportMonthlyCsv);
  elements.exportJsonButton.addEventListener("click", exportBackupJson);
  elements.importJsonInput.addEventListener("change", importBackupJson);
  elements.importCsvInput.addEventListener("change", importStudentCsv);
  elements.addStudentButton.addEventListener("click", () => openStudentDialog());
  elements.addClassButton.addEventListener("click", () => openClassDialog());
  elements.studentForm.addEventListener("submit", saveStudent);
  elements.classForm.addEventListener("submit", saveClass);
  elements.deleteStudentButton.addEventListener("click", deleteStudent);
  elements.deleteClassButton.addEventListener("click", deleteClass);
  elements.closeStudentDialogButton.addEventListener("click", () => elements.studentDialog.close());
  elements.closeClassDialogButton.addEventListener("click", () => elements.classDialog.close());
  elements.installButton.addEventListener("click", installApp);
}

function renderAll() {
  populateFilterOptions();
  renderTodayView();
  renderStudentsView();
  renderRecordsView();
  renderReportsView();
}

function renderTodayView() {
  const today = new Date();
  const todayStudents = getTodayStudents();
  const completedCount = todayStudents.filter((student) => getAttendance(student.id, todayIso())).length;

  elements.todayTitle.textContent = `${formatDate(today)} · ${weekdayLabel(today.getDay())}`;
  elements.todayScheduledCount.textContent = String(todayStudents.length);
  elements.todayCompletedCount.textContent = String(completedCount);
  elements.todayList.innerHTML = "";

  if (!todayStudents.length) {
    elements.todayList.innerHTML = `<div class="detail-card empty-state"><p>今天没有安排上课的班级，明天再来打卡即可。</p></div>`;
    return;
  }

  todayStudents
    .sort((a, b) => a.className.localeCompare(b.className, "zh-Hans-CN") || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .forEach((student) => elements.todayList.appendChild(createTodayStudentCard(student)));
}

function renderStudentsView() {
  const searchTerm = elements.studentSearchInput.value.trim().toLowerCase();
  const classCards = state.classes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))
    .map((classItem) => {
      const studentCount = state.students.filter((student) => student.classId === classItem.id && student.active !== false).length;
      return `
        <article class="class-card">
          <div class="class-card-header">
            <div>
              <h3>${escapeHtml(classItem.name)}</h3>
              <p class="student-meta">${formatSchedule(classItem.schedule)}</p>
            </div>
            <span class="chip">${studentCount} 人</span>
          </div>
          <div class="toolbar">
            <button class="ghost-button small" type="button" data-edit-class="${classItem.id}">编辑班级</button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.classSummary.innerHTML = classCards;
  [...elements.classSummary.querySelectorAll("[data-edit-class]")].forEach((button) => {
    button.addEventListener("click", () => openClassDialog(button.dataset.editClass));
  });

  const filteredStudents = state.students
    .filter((student) => {
      const classItem = getClassById(student.classId);
      const haystack = `${student.name} ${student.note || ""} ${classItem?.name || ""}`.toLowerCase();
      return student.active !== false && (!searchTerm || haystack.includes(searchTerm));
    })
    .sort((a, b) => {
      const classA = getClassById(a.classId)?.name || "";
      const classB = getClassById(b.classId)?.name || "";
      return classA.localeCompare(classB, "zh-Hans-CN") || a.name.localeCompare(b.name, "zh-Hans-CN");
    });

  elements.studentDirectory.innerHTML = "";
  filteredStudents.forEach((student) => {
    const card = document.createElement("article");
    card.className = "student-card";
    card.innerHTML = `
      <button class="student-main" type="button" data-open-records="${student.id}">
        <div class="avatar" style="background:${avatarColor(student.name)}">${getInitial(student.name)}</div>
        <div>
          <h3>${escapeHtml(student.name)}</h3>
          <p class="student-meta">${escapeHtml(getClassById(student.classId)?.name || "未分班")} · ${escapeHtml(student.note || "点击查看记录")}</p>
        </div>
      </button>
      <div class="toolbar">
        <button class="ghost-button small" type="button" data-edit-student="${student.id}">编辑</button>
      </div>
    `;
    card.querySelector("[data-open-records]").addEventListener("click", () => {
      const classId = getClassById(student.classId)?.id || "";
      selectedStudentId = student.id;
      elements.recordsClassFilter.value = classId;
      syncStudentOptions(elements.recordsClassFilter, elements.recordsStudentFilter, student.id);
      switchView("records");
      renderRecordsView();
    });
    card.querySelector("[data-edit-student]").addEventListener("click", () => openStudentDialog(student.id));
    elements.studentDirectory.appendChild(card);
  });
}

function renderRecordsView() {
  const scope = getRangeScope(elements.recordsStartMonthInput.value, elements.recordsEndMonthInput.value);
  const recordsData = getFilteredAttendanceRecords({
    classId: elements.recordsClassFilter.value,
    studentId: elements.recordsStudentFilter.value,
    startDate: scope.startDate,
    endDate: scope.endDate,
  });
  const summary = buildAggregateSummary(recordsData.rows);
  const selectedStudent = elements.recordsStudentFilter.value
    ? state.students.find((item) => item.id === elements.recordsStudentFilter.value)
    : null;

  elements.recordsSummaryCards.innerHTML = `
    <div class="summary-card"><span>应上课次</span><strong>${summary.scheduled}</strong></div>
    <div class="summary-card"><span>已出勤</span><strong>${summary.present}</strong></div>
    <div class="summary-card"><span>未出勤</span><strong>${summary.absent}</strong></div>
    <div class="summary-card"><span>待补录</span><strong>${summary.pending}</strong></div>
  `;

  const header = selectedStudent
    ? `
      <div class="student-main">
        <div class="avatar" style="background:${avatarColor(selectedStudent.name)}">${getInitial(selectedStudent.name)}</div>
        <div>
          <h3>${escapeHtml(selectedStudent.name)}</h3>
          <p class="student-meta">${escapeHtml(getClassById(selectedStudent.classId)?.name || "未分班")} · ${escapeHtml(selectedStudent.note || "无备注")}</p>
        </div>
      </div>
    `
    : `
      <div>
        <h3>筛选范围内记录</h3>
        <p class="filter-caption">${escapeHtml(scope.label)}</p>
      </div>
    `;

  const pendingDates = summary.pendingDates.slice(0, 12);
  const parentMessage = selectedStudent ? buildParentMessage(selectedStudent, recordsData.rows[0], scope) : "";
  const pendingBlock = pendingDates.length
    ? `
      <div class="list-card">
        <h3>待补录日期</h3>
        <div class="record-list tight">
          ${pendingDates.map((item) => `
            <div class="record-item">
              <div>
                <strong>${escapeHtml(item.date)}</strong>
                <p class="student-meta">${escapeHtml(item.className)} · ${escapeHtml(item.studentName)}</p>
              </div>
              <span class="record-badge pending">待补录</span>
            </div>
          `).join("")}
        </div>
      </div>
    `
    : "";
  const parentMessageBlock = selectedStudent && recordsData.rows[0]
    ? `
      <div class="message-card">
        <div class="section-heading">
          <div>
            <h3>家长通知文案</h3>
            <p class="filter-caption">已按当前筛选范围自动生成，可直接复制后发送。</p>
          </div>
          <button id="copyParentMessageButton" class="primary-button small" type="button">复制文案</button>
        </div>
        <div id="parentMessageText" class="message-text">${escapeHtml(parentMessage)}</div>
      </div>
    `
    : "";

  elements.selectedStudentCard.className = "detail-card";
  elements.selectedStudentCard.innerHTML = `
    ${header}
    <p class="filter-caption">已按 ${escapeHtml(recordsData.filterLabel)} 查询。</p>
    ${parentMessageBlock}
    ${pendingBlock}
    <div>
      <h3>出勤明细</h3>
      <div class="record-list">
        ${recordsData.recordItems.length ? recordsData.recordItems.map((record) => `
          <div class="record-item">
            <div>
              <strong>${escapeHtml(record.date)}</strong>
              <p class="student-meta">${escapeHtml(record.className)} · ${escapeHtml(record.studentName)}${record.status === "absent" ? ` · 原因：${escapeHtml(record.reason || "未填写")}` : ""}</p>
            </div>
            <span class="record-badge ${record.status}">${record.status === "present" ? "出勤" : "未出勤"}</span>
          </div>
        `).join("") : `<div class="record-item"><p>这个筛选范围内还没有已记录的出勤数据。</p></div>`}
      </div>
    </div>
  `;

  const copyButton = document.querySelector("#copyParentMessageButton");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const ok = await copyText(parentMessage);
      copyButton.textContent = ok ? "已复制" : "复制失败";
      setTimeout(() => {
        copyButton.textContent = "复制文案";
      }, 1500);
    });
  }
}

function renderReportsView() {
  const scope = getRangeScope(elements.reportStartMonthInput.value, elements.reportEndMonthInput.value);
  const reportRows = buildReportRows({
    classId: elements.reportClassFilter.value,
    studentId: elements.reportStudentFilter.value,
    startDate: scope.startDate,
    endDate: scope.endDate,
  });
  const totals = reportRows.reduce((acc, row) => {
    acc.scheduled += row.scheduled;
    acc.present += row.present;
    acc.absent += row.absent;
    acc.pending += row.pending;
    return acc;
  }, { scheduled: 0, present: 0, absent: 0, pending: 0 });

  elements.monthlySummaryCards.innerHTML = `
    <div class="summary-card"><span>统计范围</span><strong style="font-size:18px">${escapeHtml(scope.shortLabel)}</strong></div>
    <div class="summary-card"><span>应上课次</span><strong>${totals.scheduled}</strong></div>
    <div class="summary-card"><span>已出勤</span><strong>${totals.present}</strong></div>
    <div class="summary-card"><span>未出勤</span><strong>${totals.absent}</strong></div>
    <div class="summary-card"><span>待补录</span><strong>${totals.pending}</strong></div>
  `;

  elements.monthlyTableBody.innerHTML = reportRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.className)}</td>
      <td>${escapeHtml(row.studentName)}</td>
      <td>${row.scheduled}</td>
      <td>${row.present}</td>
      <td>${row.absent}</td>
      <td>${row.pending}</td>
    </tr>
  `).join("");
}

function createTodayStudentCard(student) {
  const fragment = elements.todayStudentTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".student-card");
  const mainButton = fragment.querySelector(".student-main");
  const avatar = fragment.querySelector(".avatar");
  const studentName = fragment.querySelector(".student-name");
  const studentMeta = fragment.querySelector(".student-meta");
  const presentButton = fragment.querySelector(".status-button.present");
  const absentButton = fragment.querySelector(".status-button.absent");
  const absencePanel = fragment.querySelector(".absence-panel");
  const customReasonInput = fragment.querySelector(".custom-reason");
  const record = getAttendance(student.id, todayIso());

  avatar.textContent = getInitial(student.name);
  avatar.style.background = avatarColor(student.name);
  studentName.textContent = student.name;
  studentMeta.textContent = `${student.className} · ${weekdayLabel(new Date().getDay())}`;

  mainButton.addEventListener("click", () => {
    const classId = getClassById(student.classId)?.id || "";
    selectedStudentId = student.id;
    elements.recordsClassFilter.value = classId;
    syncStudentOptions(elements.recordsClassFilter, elements.recordsStudentFilter, student.id);
    switchView("records");
    renderRecordsView();
  });

  if (record?.status === "present") {
    presentButton.classList.add("active");
  }

  if (record?.status === "absent") {
    absentButton.classList.add("active");
    absencePanel.classList.remove("hidden");
    activateReasonButton(absencePanel, record.reason);
    if (record.reason && !defaultAbsenceReasons.includes(record.reason)) {
      customReasonInput.classList.remove("hidden");
      customReasonInput.value = record.reason;
    }
  }

  presentButton.addEventListener("click", () => {
    upsertAttendance(student.id, todayIso(), "present", "");
    persistAndRender();
  });

  absentButton.addEventListener("click", () => {
    upsertAttendance(student.id, todayIso(), "absent", record?.reason || "请假");
    persistAndRender();
  });

  fragment.querySelectorAll(".reason-chip").forEach((button) => {
    button.addEventListener("click", () => {
      const reason = button.dataset.reason;
      if (reason === "其他") {
        customReasonInput.classList.remove("hidden");
        customReasonInput.focus();
        const current = getAttendance(student.id, todayIso());
        upsertAttendance(student.id, todayIso(), "absent", current?.reason && !defaultAbsenceReasons.includes(current.reason) ? current.reason : "");
      } else {
        customReasonInput.classList.add("hidden");
        customReasonInput.value = "";
        upsertAttendance(student.id, todayIso(), "absent", reason);
      }
      persistAndRender();
    });
  });

  customReasonInput.addEventListener("input", (event) => {
    upsertAttendance(student.id, todayIso(), "absent", event.target.value.trim());
    persistState();
  });

  return card;
}

function activateReasonButton(panel, reason) {
  panel.querySelectorAll(".reason-chip").forEach((button) => {
    const isActive = button.dataset.reason === reason || (button.dataset.reason === "其他" && reason && !defaultAbsenceReasons.includes(reason));
    button.classList.toggle("active", isActive);
  });
}

function openStudentDialog(studentId = "") {
  populateClassOptions();
  if (studentId) {
    const student = state.students.find((item) => item.id === studentId);
    elements.studentDialogTitle.textContent = "编辑学员";
    elements.studentIdInput.value = student.id;
    elements.studentNameInput.value = student.name;
    elements.studentClassInput.value = student.classId;
    elements.studentNoteInput.value = student.note || "";
    elements.deleteStudentButton.classList.remove("hidden");
  } else {
    elements.studentDialogTitle.textContent = "新增学员";
    elements.studentForm.reset();
    elements.studentIdInput.value = "";
    elements.deleteStudentButton.classList.add("hidden");
  }
  elements.studentDialog.showModal();
}

function saveStudent(event) {
  event.preventDefault();
  const id = elements.studentIdInput.value;
  const payload = {
    id: id || crypto.randomUUID(),
    name: elements.studentNameInput.value.trim(),
    classId: elements.studentClassInput.value,
    note: elements.studentNoteInput.value.trim(),
    active: true,
    createdAt: id ? state.students.find((item) => item.id === id)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.name || !payload.classId) return;

  const index = state.students.findIndex((item) => item.id === payload.id);
  if (index >= 0) state.students[index] = payload;
  else state.students.push(payload);

  elements.studentDialog.close();
  persistAndRender();
}

function deleteStudent() {
  const id = elements.studentIdInput.value;
  state.students = state.students.filter((student) => student.id !== id);
  state.attendance = state.attendance.filter((record) => record.studentId !== id);
  if (selectedStudentId === id) selectedStudentId = null;
  elements.studentDialog.close();
  persistAndRender();
}

function openClassDialog(classId = "") {
  if (classId) {
    const classItem = getClassById(classId);
    elements.classDialogTitle.textContent = "编辑班级";
    elements.classIdInput.value = classItem.id;
    elements.classNameInput.value = classItem.name;
    elements.deleteClassButton.classList.remove("hidden");
    [...elements.weekdayCheckboxes.querySelectorAll("input")].forEach((input) => {
      input.checked = classItem.schedule.includes(Number(input.value));
    });
  } else {
    elements.classDialogTitle.textContent = "新增班级";
    elements.classForm.reset();
    elements.classIdInput.value = "";
    elements.deleteClassButton.classList.add("hidden");
  }
  elements.classDialog.showModal();
}

function saveClass(event) {
  event.preventDefault();
  const id = elements.classIdInput.value;
  const schedule = [...elements.weekdayCheckboxes.querySelectorAll("input:checked")].map((input) => Number(input.value)).sort();
  if (!elements.classNameInput.value.trim() || !schedule.length) return;

  const payload = {
    id: id || crypto.randomUUID(),
    name: elements.classNameInput.value.trim(),
    schedule,
  };
  const index = state.classes.findIndex((item) => item.id === payload.id);
  if (index >= 0) state.classes[index] = payload;
  else state.classes.push(payload);

  elements.classDialog.close();
  persistAndRender();
}

function deleteClass() {
  const id = elements.classIdInput.value;
  const hasStudents = state.students.some((student) => student.classId === id);
  if (hasStudents) {
    alert("请先调整或删除该班级下的学员，再删除班级。");
    return;
  }
  state.classes = state.classes.filter((classItem) => classItem.id !== id);
  elements.classDialog.close();
  persistAndRender();
}

function populateClassOptions() {
  elements.studentClassInput.innerHTML = state.classes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))
    .map((classItem) => `<option value="${classItem.id}">${escapeHtml(classItem.name)}</option>`)
    .join("");
}

function renderWeekdayOptions() {
  elements.weekdayCheckboxes.innerHTML = weekdays.map((day) => `
    <label class="weekday-option">
      <input type="checkbox" value="${day.value}">
      <span>${day.label}</span>
    </label>
  `).join("");
}

function switchView(target) {
  elements.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.view === target));
  elements.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === target));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialData);
    const parsed = JSON.parse(raw);
    if (!parsed.classes || !parsed.students || !parsed.attendance) throw new Error("invalid");
    return parsed;
  } catch {
    return structuredClone(initialData);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function persistAndRender() {
  persistState();
  renderAll();
}

function upsertAttendance(studentId, date, status, reason) {
  const existing = state.attendance.find((record) => record.studentId === studentId && record.date === date);
  if (existing) {
    existing.status = status;
    existing.reason = status === "absent" ? reason : "";
    existing.updatedAt = new Date().toISOString();
    return;
  }
  state.attendance.push({
    id: crypto.randomUUID(),
    studentId,
    date,
    status,
    reason: status === "absent" ? reason : "",
    updatedAt: new Date().toISOString(),
  });
}

function getAttendance(studentId, date) {
  return state.attendance.find((record) => record.studentId === studentId && record.date === date);
}

function getTodayStudents() {
  const weekday = new Date().getDay();
  return state.students
    .filter((student) => student.active !== false)
    .map((student) => ({
      ...student,
      className: getClassById(student.classId)?.name || "未分班",
      schedule: getClassById(student.classId)?.schedule || [],
    }))
    .filter((student) => student.schedule.includes(weekday));
}

function exportMonthlyCsv() {
  const scope = getRangeScope(elements.reportStartMonthInput.value, elements.reportEndMonthInput.value);
  const rows = buildReportRows({
    classId: elements.reportClassFilter.value,
    studentId: elements.reportStudentFilter.value,
    startDate: scope.startDate,
    endDate: scope.endDate,
  });
  const csv = [
    ["班级", "学员", "应上", "出勤", "缺勤", "待补录"].join(","),
    ...rows.map((row) => [row.className, row.studentName, row.scheduled, row.present, row.absent, row.pending].map(csvEscape).join(",")),
  ].join("\n");
  downloadFile(`课时统计-${scope.fileLabel}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8;");
}

function exportBackupJson() {
  downloadFile(`课时统计备份-${todayIso()}.json`, JSON.stringify(state, null, 2), "application/json");
}

function importBackupJson(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  file.text().then((text) => {
    const parsed = JSON.parse(text);
    if (!parsed.classes || !parsed.students || !parsed.attendance) throw new Error("格式不正确");
    state.classes = parsed.classes;
    state.students = parsed.students;
    state.attendance = parsed.attendance;
    selectedStudentId = null;
    persistAndRender();
    alert("备份导入成功。");
  }).catch(() => alert("JSON 导入失败，请确认文件格式正确。"));
  event.target.value = "";
}

function importStudentCsv(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  file.text().then((text) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const [, ...rows] = lines;
    rows.forEach((row) => {
      const [className, studentName, scheduleText = ""] = parseCsvLine(row);
      if (!className || !studentName) return;
      let classItem = state.classes.find((item) => item.name === className.trim());
      if (!classItem) {
        classItem = {
          id: crypto.randomUUID(),
          name: className.trim(),
          schedule: parseScheduleText(scheduleText),
        };
        state.classes.push(classItem);
      }
      const duplicated = state.students.some((student) => student.classId === classItem.id && student.name === studentName.trim());
      if (duplicated) return;
      state.students.push({
        id: crypto.randomUUID(),
        classId: classItem.id,
        name: studentName.trim(),
        note: "",
        active: true,
        createdAt: new Date().toISOString(),
      });
    });
    persistAndRender();
    alert("CSV 学员导入完成。");
  }).catch(() => alert("CSV 导入失败，请检查内容。"));
  event.target.value = "";
}

function parseScheduleText(text) {
  const mapping = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0,
    周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 0, 周天: 0,
  };
  const hits = new Set();
  Object.entries(mapping).forEach(([key, value]) => {
    if (text.includes(key)) hits.add(value);
  });
  return hits.size ? [...hits].sort() : [1, 3, 5];
}

function parseCsvLine(line) {
  const output = [];
  let current = "";
  let insideQuotes = false;
  for (const char of line) {
    if (char === '"') insideQuotes = !insideQuotes;
    else if (char === "," && !insideQuotes) {
      output.push(current);
      current = "";
    } else current += char;
  }
  output.push(current);
  return output.map((part) => part.trim().replace(/^"|"$/g, ""));
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    elements.installButton.classList.remove("hidden");
  });
}

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  elements.installButton.classList.add("hidden");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function setDefaultRangeInputs() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const currentMonth = `${now.getFullYear()}-${month}`;
  elements.recordsStartMonthInput.value = currentMonth;
  elements.recordsEndMonthInput.value = currentMonth;
  elements.reportStartMonthInput.value = currentMonth;
  elements.reportEndMonthInput.value = currentMonth;
}

function populateFilterOptions() {
  fillClassSelect(elements.recordsClassFilter, elements.recordsClassFilter.value);
  fillClassSelect(elements.reportClassFilter, elements.reportClassFilter.value);
  syncStudentOptions(elements.recordsClassFilter, elements.recordsStudentFilter, elements.recordsStudentFilter.value || selectedStudentId);
  syncStudentOptions(elements.reportClassFilter, elements.reportStudentFilter, elements.reportStudentFilter.value);
}

function fillClassSelect(select, selectedValue = "") {
  select.innerHTML = [
    `<option value="">全部班级</option>`,
    ...state.classes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))
      .map((classItem) => `<option value="${classItem.id}">${escapeHtml(classItem.name)}</option>`),
  ].join("");
  select.value = state.classes.some((item) => item.id === selectedValue) ? selectedValue : "";
}

function syncStudentOptions(classSelect, studentSelect, selectedValue = "") {
  const classId = classSelect.value;
  const students = state.students
    .filter((student) => student.active !== false)
    .filter((student) => !classId || student.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

  studentSelect.innerHTML = [
    `<option value="">全部学员</option>`,
    ...students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`),
  ].join("");

  if (students.some((student) => student.id === selectedValue)) studentSelect.value = selectedValue;
  else studentSelect.value = "";
}

function handleRecordsClassChange() {
  syncStudentOptions(elements.recordsClassFilter, elements.recordsStudentFilter, elements.recordsStudentFilter.value);
  selectedStudentId = elements.recordsStudentFilter.value || null;
  renderRecordsView();
}

function handleRecordsStudentChange() {
  selectedStudentId = elements.recordsStudentFilter.value || null;
  renderRecordsView();
}

function handleReportsClassChange() {
  syncStudentOptions(elements.reportClassFilter, elements.reportStudentFilter, elements.reportStudentFilter.value);
  renderReportsView();
}

function getRangeScope(startMonth, endMonth) {
  const months = [startMonth, endMonth].filter(Boolean).sort();
  const safeStartMonth = months[0] || startMonth || endMonth;
  const safeEndMonth = months[1] || months[0] || startMonth || endMonth;
  const startDate = `${safeStartMonth}-01`;
  const endDate = getMonthEndDate(safeEndMonth);
  return {
    startDate,
    endDate,
    label: `${formatMonthLabel(safeStartMonth)} 至 ${formatMonthLabel(safeEndMonth)}`,
    shortLabel: safeStartMonth === safeEndMonth ? formatMonthLabel(safeStartMonth) : `${formatMonthLabel(safeStartMonth)}-${formatMonthLabel(safeEndMonth)}`,
    fileLabel: safeStartMonth === safeEndMonth ? safeStartMonth : `${safeStartMonth}_to_${safeEndMonth}`,
  };
}

function getFilteredAttendanceRecords({ classId, studentId, startDate, endDate }) {
  const rows = buildReportRows({ classId, studentId, startDate, endDate });
  const studentIds = new Set(rows.map((row) => row.studentId));
  const recordItems = state.attendance
    .filter((record) => record.date >= startDate && record.date <= endDate)
    .filter((record) => studentIds.has(record.studentId))
    .map((record) => {
      const student = state.students.find((item) => item.id === record.studentId);
      const classItem = getClassById(student?.classId);
      return {
        ...record,
        studentName: student?.name || "未知学员",
        className: classItem?.name || "未分班",
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className, "zh-Hans-CN"));

  return {
    rows,
    recordItems,
    filterLabel: [
      classId ? getClassById(classId)?.name || "班级" : "全部班级",
      studentId ? state.students.find((item) => item.id === studentId)?.name || "学员" : "全部学员",
      `${startDate} 至 ${endDate}`,
    ].join(" / "),
  };
}

function buildAggregateSummary(rows) {
  return rows.reduce((acc, row) => {
    acc.scheduled += row.scheduled;
    acc.present += row.present;
    acc.absent += row.absent;
    acc.pending += row.pending;
    acc.pendingDates.push(...row.pendingDates);
    return acc;
  }, { scheduled: 0, present: 0, absent: 0, pending: 0, pendingDates: [] });
}

function buildReportRows({ classId = "", studentId = "", startDate, endDate }) {
  const today = todayIso();

  return state.students
    .filter((student) => student.active !== false)
    .filter((student) => !classId || student.classId === classId)
    .filter((student) => !studentId || student.id === studentId)
    .map((student) => {
      const classItem = getClassById(student.classId);
      const scheduledDates = getScheduledDatesBetween(startDate, endDate, classItem?.schedule || []);
      const records = state.attendance.filter((record) => record.studentId === student.id && record.date >= startDate && record.date <= endDate);
      const present = records.filter((record) => record.status === "present").length;
      const absent = records.filter((record) => record.status === "absent").length;
      const pendingDates = scheduledDates
        .filter((date) => date <= today && !records.some((record) => record.date === date))
        .map((date) => ({ date, className: classItem?.name || "未分班", studentName: student.name }));
      return {
        studentId: student.id,
        className: classItem?.name || "未分班",
        studentName: student.name,
        scheduled: scheduledDates.length,
        present,
        absent,
        pending: pendingDates.length,
        pendingDates,
      };
    })
    .sort((a, b) => a.className.localeCompare(b.className, "zh-Hans-CN") || a.studentName.localeCompare(b.studentName, "zh-Hans-CN"));
}

function buildParentMessage(student, row, scope) {
  const absenceSummary = summarizeAbsenceReasons(student.id, scope.startDate, scope.endDate);
  const reasonText = absenceSummary.length
    ? `缺勤原因：${absenceSummary.join("；")}。`
    : "本时间段内暂无缺勤记录。";
  const pendingText = row.pending ? `目前还有 ${row.pending} 次待补录。` : "本时间段记录已补录完整。";
  return `${student.name}家长您好：

这是孩子在${scope.label}的上课情况汇总。
应上课次：${row.scheduled} 次
实际出勤：${row.present} 次
未出勤：${row.absent} 次
${reasonText}
${pendingText}

如您需要，我也可以继续为您发送更详细的到课日期明细。`;
}

function summarizeAbsenceReasons(studentId, startDate, endDate) {
  const counts = new Map();
  state.attendance
    .filter((record) => record.studentId === studentId && record.status === "absent")
    .filter((record) => record.date >= startDate && record.date <= endDate)
    .forEach((record) => {
      const reason = record.reason || "未填写";
      counts.set(reason, (counts.get(reason) || 0) + 1);
    });
  return [...counts.entries()].map(([reason, count]) => `${reason}${count}次`);
}

function getScheduledDatesBetween(startDate, endDate, schedule) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    if (schedule.includes(cursor.getDay())) dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function getMonthEndDate(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return toIsoDate(new Date(year, month, 0));
}

function getClassById(id) {
  return state.classes.find((item) => item.id === id);
}

function weekdayLabel(day) {
  return weekdays.find((item) => item.value === day)?.label || "";
}

function formatSchedule(schedule) {
  return schedule.length ? schedule.map(weekdayLabel).join(" / ") : "未设置上课周期";
}

function todayIso() {
  return toIsoDate(new Date());
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatMonthLabel(monthValue) {
  const [year, month] = monthValue.split("-");
  return `${year}年${Number(month)}月`;
}

function getInitial(name) {
  return name.trim().slice(0, 1).toUpperCase();
}

function avatarColor(name) {
  const palette = ["#d47643", "#5183c4", "#4e9a7a", "#bc5b73", "#8e68c7", "#bc8642"];
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
