const STORAGE_KEY = "lesson-tracker-app-v1";
const STABLE_BACKUP_DB = "lesson-tracker-stable-storage";
const STABLE_BACKUP_STORE = "snapshots";
const STABLE_BACKUP_ID = "latest";
const STABLE_BACKUP_LIMIT = 12;
const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
const defaultAbsenceReasons = ["请假", "生病", "外出", "其他"];

const initialData = {
  classes: [
    { id: crypto.randomUUID(), name: "吴中A班", dates: generateDatesForWeekdays([2, 4, 6]) },
    { id: crypto.randomUUID(), name: "吴中D班", dates: generateDatesForWeekdays([2, 4, 6]) },
    { id: crypto.randomUUID(), name: "吴中E班", dates: generateDatesForWeekdays([2, 4, 6]) },
    { id: crypto.randomUUID(), name: "吴中F班", dates: generateDatesForWeekdays([1, 3, 5]) },
    { id: crypto.randomUUID(), name: "园区A班", dates: generateDatesForWeekdays([0, 3, 5]) },
  ],
  students: [],
  attendance: [],
  cellStyles: [],
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
      packageTotal: "",
      lessonTotal: 0,
      active: true,
      createdAt: new Date().toISOString(),
    });
  });
});

const state = loadState();
let selectedStudentId = null;
let deferredPrompt = null;
let editingClassDates = [];
let editingClassCalendarMonth = todayIso().slice(0, 7);
const classCalendarMonths = {};
let recordsViewMode = "calendar";
let feedbackAudioContext = null;
let pendingTodayRecordOpen = null;
let pendingClassDateToggle = null;
let toastTimer = null;

const elements = {
  installButton: document.querySelector("#installButton"),
  navButtons: [...document.querySelectorAll(".nav-button")],
  panels: [...document.querySelectorAll(".panel")],
  todayTitle: document.querySelector("#todayTitle"),
  todayPendingCount: document.querySelector("#todayPendingCount"),
  todayCompletedCount: document.querySelector("#todayCompletedCount"),
  todayAbsentCount: document.querySelector("#todayAbsentCount"),
  attendanceDateInput: document.querySelector("#attendanceDateInput"),
  attendanceClassFilter: document.querySelector("#attendanceClassFilter"),
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
  studentPackageInput: document.querySelector("#studentPackageInput"),
  studentLessonTotalInput: document.querySelector("#studentLessonTotalInput"),
  studentNoteInput: document.querySelector("#studentNoteInput"),
  deleteStudentButton: document.querySelector("#deleteStudentButton"),
  closeStudentDialogButton: document.querySelector("#closeStudentDialogButton"),
  classDialog: document.querySelector("#classDialog"),
  classForm: document.querySelector("#classForm"),
  classDialogTitle: document.querySelector("#classDialogTitle"),
  classIdInput: document.querySelector("#classIdInput"),
  classNameInput: document.querySelector("#classNameInput"),
  classDateInput: document.querySelector("#classDateInput"),
  addClassDateButton: document.querySelector("#addClassDateButton"),
  classCalendarPrevButton: document.querySelector("#classCalendarPrevButton"),
  classCalendarNextButton: document.querySelector("#classCalendarNextButton"),
  classCalendarMonthLabel: document.querySelector("#classCalendarMonthLabel"),
  classScheduleCalendar: document.querySelector("#classScheduleCalendar"),
  classDatesList: document.querySelector("#classDatesList"),
  deleteClassButton: document.querySelector("#deleteClassButton"),
  closeClassDialogButton: document.querySelector("#closeClassDialogButton"),
  todayStudentTemplate: document.querySelector("#todayStudentTemplate"),
  appToast: document.querySelector("#appToast"),
};

init();

function init() {
  registerServiceWorker();
  setupInstallPrompt();
  setupDurableStorage();
  bindEvents();
  setDefaultRangeInputs();
  renderAll();
  restoreStableBackupIfNeeded();
}

function bindEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tactileFeedback("tap");
      switchView(button.dataset.target);
    });
  });

  elements.attendanceDateInput.addEventListener("input", renderTodayView);
  elements.attendanceClassFilter.addEventListener("change", renderTodayView);

  elements.markAllPresentButton.addEventListener("click", () => {
    getStudentsForAttendanceDate().forEach((student) => upsertAttendance(student.id, attendanceDate(), "present", ""));
    persistAndRender();
  });

  elements.resetTodayButton.addEventListener("click", () => {
    const date = attendanceDate();
    state.attendance
      .filter((record) => record.date === date)
      .forEach((record) => clearAttendance(record.studentId, record.date));
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
  elements.addClassDateButton.addEventListener("click", addEditingClassDate);
  elements.classCalendarPrevButton.addEventListener("click", () => shiftEditingClassMonth(-1));
  elements.classCalendarNextButton.addEventListener("click", () => shiftEditingClassMonth(1));
  elements.studentForm.addEventListener("submit", saveStudent);
  elements.classForm.addEventListener("submit", saveClass);
  elements.deleteStudentButton.addEventListener("click", deleteStudent);
  elements.deleteClassButton.addEventListener("click", deleteClass);
  elements.closeStudentDialogButton.addEventListener("click", () => elements.studentDialog.close());
  elements.closeClassDialogButton.addEventListener("click", () => elements.classDialog.close());
  elements.installButton.addEventListener("click", installApp);
  window.addEventListener("pagehide", persistState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistState();
  });
}

function renderAll() {
  populateFilterOptions();
  renderTodayView();
  renderStudentsView();
  renderRecordsView();
  renderReportsView();
}

function renderTodayView() {
  const date = attendanceDate();
  const targetDate = new Date(`${date}T00:00:00`);
  const todayStudents = getStudentsForAttendanceDate();
  const completedCount = todayStudents.filter((student) => getAttendance(student.id, date)).length;
  const absentCount = todayStudents.filter((student) => getAttendance(student.id, date)?.status === "absent").length;
  const presentCount = todayStudents.filter((student) => getAttendance(student.id, date)?.status === "present").length;
  const pendingCount = Math.max(todayStudents.length - completedCount, 0);

  elements.todayTitle.textContent = `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;
  elements.todayPendingCount.textContent = String(pendingCount);
  elements.todayCompletedCount.textContent = String(presentCount);
  elements.todayAbsentCount.textContent = String(absentCount);
  elements.todayList.innerHTML = "";

  if (!todayStudents.length) {
    elements.todayList.innerHTML = `<div class="detail-card empty-state"><p>这一天没有安排上课的班级。可以到“学员管理”里编辑班级，加入上课日期。</p></div>`;
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
      const scheduleMonth = getClassCalendarMonth(classItem.id);
      return `
        <article class="class-card">
          <div class="class-card-header">
            <div>
              <h3>${escapeHtml(classItem.name)}</h3>
            </div>
            <span class="chip">${studentCount} 人</span>
          </div>
          <div class="class-quick-actions">
            <div class="calendar-toolbar compact-toolbar">
              <button class="icon-button" type="button" data-class-month-prev="${classItem.id}" aria-label="上个月">‹</button>
              <strong>${escapeHtml(formatMonthLabel(scheduleMonth))}</strong>
              <button class="icon-button" type="button" data-class-month-next="${classItem.id}" aria-label="下个月">›</button>
            </div>
            ${buildClassScheduleCalendar(classItem, scheduleMonth, "card")}
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
  [...elements.classSummary.querySelectorAll("[data-class-month-prev]")].forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.classMonthPrev;
      classCalendarMonths[id] = shiftMonth(getClassCalendarMonth(id), -1);
      renderStudentsView();
    });
  });
  [...elements.classSummary.querySelectorAll("[data-class-month-next]")].forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.classMonthNext;
      classCalendarMonths[id] = shiftMonth(getClassCalendarMonth(id), 1);
      renderStudentsView();
    });
  });
  [...elements.classSummary.querySelectorAll("[data-toggle-class-date]")].forEach((button) => {
    button.addEventListener("click", () => handleClassDateToggle(button.dataset.toggleClassDate, button.dataset.date, button));
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
        <div class="avatar" style="${avatarStyleForStudent(student)}">${getInitial(student.name)}</div>
        <div>
          <h3>${escapeHtml(student.name)}</h3>
          <p class="student-meta">${escapeHtml(getClassById(student.classId)?.name || "未分班")} · 累计${getStudentLessonTotal(student.id)}课${student.note ? ` · ${escapeHtml(student.note)}` : ""}</p>
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

  const packageProgress = selectedStudent ? getStudentPackageProgress(selectedStudent.id) : null;
  const lessonTotal = selectedStudent ? getStudentLessonTotal(selectedStudent.id) : 0;
  const packageLine = selectedStudent && selectedStudent.packageTotal
    ? `<p class="package-progress ${packageProgress.current >= packageProgress.total ? "due" : ""}">课包：已上 ${packageProgress.current} / ${packageProgress.total}${packageProgress.current >= packageProgress.total ? " · 需续费" : ""}</p>`
    : "";
  const lessonLine = selectedStudent
    ? `<p class="package-progress lesson-total">累计课时：${lessonTotal}</p>`
    : "";
  const header = selectedStudent
    ? `
      <div class="student-main">
        <div class="avatar" style="${avatarStyleForStudent(selectedStudent)}">${getInitial(selectedStudent.name)}</div>
        <div>
          <h3>${escapeHtml(selectedStudent.name)}</h3>
          <p class="student-meta">${escapeHtml(getClassById(selectedStudent.classId)?.name || "未分班")} · ${escapeHtml(selectedStudent.note || "无备注")}</p>
          ${lessonLine}
          ${packageLine}
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
  const detailRows = buildAttendanceDetailRows(recordsData.rows, scope.startDate, scope.endDate);
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
  const calendarBlock = selectedStudent
    ? `
      <div class="view-pane ${recordsViewMode === "calendar" ? "active" : ""}" data-record-pane="calendar">
        <div class="section-heading">
          <div>
            <h3>当月日历</h3>
            <p class="filter-caption">蓝色边框代表该班上课日；绿色为出勤，红色为缺勤并显示原因。</p>
          </div>
        </div>
        ${buildStudentMonthCalendar(selectedStudent.id, elements.recordsStartMonthInput.value)}
      </div>
    `
    : `
      <div class="view-pane ${recordsViewMode === "calendar" ? "active" : ""}" data-record-pane="calendar">
        <div class="empty-state spacious"><p>选择一个学员后，会显示该学员的出勤日历。</p></div>
      </div>
    `;
  const tableBlock = selectedStudent
    ? `
    <div class="view-pane ${recordsViewMode === "table" ? "active" : ""}" data-record-pane="table">
      <div class="sheet-actions">
        <span class="sheet-total-badge">累计课时 ${lessonTotal}</span>
        <button class="ghost-button small" type="button" data-save-sheet-image="${selectedStudent.id}">保存表格图片</button>
      </div>
      ${buildStudentSpreadsheetTable(selectedStudent, scope.startDate, scope.endDate)}
    </div>
  `
    : `
    <div class="view-pane ${recordsViewMode === "table" ? "active" : ""}" data-record-pane="table">
      <div class="table-wrap detail-table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>班级</th>
              <th>学员</th>
              <th>课日</th>
              <th>状态</th>
              <th>缺勤原因</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.length ? detailRows.map((row) => `
              <tr>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.className)}</td>
                <td>${escapeHtml(row.studentName)}</td>
                <td><span class="record-badge ${row.scheduled ? "scheduled" : "neutral"}">${row.scheduled ? "有课" : "补录"}</span></td>
                <td>
                  <select class="table-status-select" data-attendance-status="${row.studentId}" data-date="${row.date}">
                    <option value="" ${!row.status ? "selected" : ""}>待补录</option>
                    <option value="present" ${row.status === "present" ? "selected" : ""}>出勤</option>
                    <option value="absent" ${row.status === "absent" ? "selected" : ""}>缺勤</option>
                  </select>
                </td>
                <td>
                  <input class="table-reason-input" type="text" value="${escapeAttribute(row.reason || "")}" placeholder="缺勤原因" data-attendance-reason="${row.studentId}" data-date="${row.date}" ${row.status === "present" ? "disabled" : ""}>
                </td>
              </tr>
            `).join("") : `<tr><td colspan="6">当前范围内没有可核对的明细。</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
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
        <textarea id="parentMessageText" class="message-text editable-message" rows="9">${escapeHtml(parentMessage)}</textarea>
      </div>
    `
    : "";

  elements.selectedStudentCard.className = "detail-card";
  elements.selectedStudentCard.innerHTML = `
    ${header}
    <p class="filter-caption">已按 ${escapeHtml(recordsData.filterLabel)} 查询。</p>
    <div class="segmented-control" role="tablist" aria-label="记录显示方式">
      <button class="${recordsViewMode === "calendar" ? "active" : ""}" type="button" data-record-view="calendar">日历视图</button>
      <button class="${recordsViewMode === "table" ? "active" : ""}" type="button" data-record-view="table">表格明细</button>
    </div>
    <div class="record-view-shell">
      ${calendarBlock}
      ${tableBlock}
    </div>
    ${parentMessageBlock}
    ${pendingBlock}
    <div class="view-pane ${recordsViewMode === "table" ? "hidden" : ""}">
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
      const messageInput = document.querySelector("#parentMessageText");
      const ok = await copyText(messageInput?.value || parentMessage);
      copyButton.textContent = ok ? "已复制" : "复制失败";
      setTimeout(() => {
        copyButton.textContent = "复制文案";
      }, 1500);
    });
  }
  bindRecordsInteractions();
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

function bindRecordsInteractions() {
  document.querySelectorAll("[data-record-view]").forEach((button) => {
    button.addEventListener("click", () => {
      tactileFeedback("tap");
      recordsViewMode = button.dataset.recordView;
      renderRecordsView();
    });
  });

  document.querySelectorAll("[data-calendar-attendance]").forEach((button) => {
    button.addEventListener("click", () => {
      tactileFeedback("tap");
      cycleAttendance(button.dataset.calendarAttendance, button.dataset.date);
      persistAndRender();
    });
  });

  document.querySelectorAll("[data-attendance-status]").forEach((select) => {
    select.addEventListener("change", () => {
      setAttendanceFromTable(select.dataset.attendanceStatus, select.dataset.date, select.value);
    });
  });

  document.querySelectorAll("[data-attendance-reason]").forEach((input) => {
    input.addEventListener("input", () => {
      const studentId = input.dataset.attendanceReason;
      const date = input.dataset.date;
      const record = getAttendance(studentId, date);
      if (!record && input.value.trim()) {
        upsertAttendance(studentId, date, "absent", input.value.trim());
      } else if (record?.status === "absent") {
        record.reason = input.value.trim();
        record.updatedAt = new Date().toISOString();
      }
      persistState();
      renderTodayView();
      renderReportsView();
    });
  });

  document.querySelectorAll("[data-sheet-status]").forEach((button) => {
    button.addEventListener("click", () => {
      tactileFeedback("tap");
      cycleAttendance(button.dataset.sheetStatus, button.dataset.date);
      persistAndRender();
    });
  });

  document.querySelectorAll("[data-sheet-lesson]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("input", () => {
      const studentId = input.dataset.sheetLesson;
      const date = input.dataset.date;
      const record = getAttendance(studentId, date);
      if (record?.status === "present") {
        const value = input.value.trim();
        if (value) {
          record.lessonNumber = value;
          const number = Number(value);
          if (Number.isFinite(number) && number > getStudentLessonTotal(studentId)) {
            setStudentLessonTotal(studentId, number);
            updateDisplayedLessonTotal(studentId);
          }
        } else delete record.lessonNumber;
        record.updatedAt = new Date().toISOString();
        persistState();
        renderTodayView();
        renderReportsView();
      }
    });
  });

  document.querySelectorAll("[data-sheet-color]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      tactileFeedback("tap");
      toggleSheetCellBlue(button.dataset.sheetColor, button.dataset.date);
      persistAndRender();
    });
  });

  document.querySelectorAll("[data-sheet-reason]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("input", () => {
      const studentId = input.dataset.sheetReason;
      const date = input.dataset.date;
      upsertAttendance(studentId, date, "absent", input.value.trim() || "请假");
      persistState();
      renderTodayView();
      renderReportsView();
    });
  });

  document.querySelectorAll("[data-save-sheet-image]").forEach((button) => {
    button.addEventListener("click", () => {
      tactileFeedback("success");
      const scope = getRangeScope(elements.recordsStartMonthInput.value, elements.recordsEndMonthInput.value);
      saveStudentSheetImage(button.dataset.saveSheetImage, scope.startDate, scope.endDate);
    });
  });
}

function setAttendanceFromTable(studentId, date, status) {
  if (!status) {
    clearAttendance(studentId, date);
  } else {
    const existing = getAttendance(studentId, date);
    const reason = status === "absent" ? existing?.reason || "请假" : "";
    upsertAttendance(studentId, date, status, reason);
  }
  persistAndRender();
}

function cycleAttendance(studentId, date) {
  const record = getAttendance(studentId, date);
  if (!record) {
    upsertAttendance(studentId, date, "present", "");
  } else if (record.status === "present") {
    upsertAttendance(studentId, date, "absent", "请假");
  } else {
    clearAttendance(studentId, date);
  }
}

function createTodayStudentCard(student) {
  const fragment = elements.todayStudentTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".student-card");
  const mainButton = fragment.querySelector(".student-main");
  const classBadge = fragment.querySelector(".class-badge");
  const studentName = fragment.querySelector(".student-name");
  const studentMeta = fragment.querySelector(".student-meta");
  const presentButton = fragment.querySelector(".status-button.present");
  const absentButton = fragment.querySelector(".status-button.absent");
  const absencePanel = fragment.querySelector(".absence-panel");
  const customReasonInput = fragment.querySelector(".custom-reason");
  const date = attendanceDate();
  const record = getAttendance(student.id, date);

  card.classList.add("attendance-card");
  if (record?.status === "present") card.classList.add("state-present");
  else if (record?.status === "absent") card.classList.add("state-absent");
  else card.classList.add("state-pending");

  classBadge.textContent = student.className;
  studentName.textContent = student.name;
  studentMeta.textContent = record?.status === "present"
    ? "出勤"
    : record?.status === "absent"
      ? record.reason ? `未出勤: ${record.reason}` : "未出勤"
      : "待打卡";

  mainButton.addEventListener("click", () => {
    handleTodayStudentRecordOpen(student, card);
  });

  if (record?.status === "present") {
    presentButton.classList.add("active");
    presentButton.setAttribute("aria-label", "重新修改出勤状态");
    presentButton.title = "重新修改出勤状态";
  }

  if (record?.status === "absent") {
    absentButton.classList.add("active");
    absentButton.setAttribute("aria-label", "重新修改出勤状态");
    absentButton.title = "重新修改出勤状态";
    if (!record.reason || record.reason === "其他") {
      absencePanel.classList.remove("hidden");
      activateReasonButton(absencePanel, record.reason);
    }
    if (record.reason === "其他") {
      customReasonInput.classList.remove("hidden");
      customReasonInput.value = "";
    }
  }

  presentButton.addEventListener("click", () => {
    tactileFeedback("success");
    if (record?.status === "present") {
      clearAttendance(student.id, date);
      persistAndRender();
      return;
    }
    upsertAttendance(student.id, date, "present", "");
    persistAndRender();
  });

  absentButton.addEventListener("click", () => {
    tactileFeedback("warning");
    if (record?.status === "absent") {
      clearAttendance(student.id, date);
      persistAndRender();
      return;
    }
    upsertAttendance(student.id, date, "absent", "");
    persistAndRender();
  });

  fragment.querySelectorAll(".reason-chip").forEach((button) => {
    button.addEventListener("click", () => {
      tactileFeedback("tap");
      const reason = button.dataset.reason;
      if (reason === "其他") {
        customReasonInput.classList.remove("hidden");
        customReasonInput.focus();
        const current = getAttendance(student.id, date);
        upsertAttendance(student.id, date, "absent", current?.reason && !defaultAbsenceReasons.includes(current.reason) ? current.reason : "其他");
      } else {
        customReasonInput.classList.add("hidden");
        customReasonInput.value = "";
        upsertAttendance(student.id, date, "absent", reason);
      }
      persistAndRender();
    });
  });

  customReasonInput.addEventListener("input", (event) => {
    upsertAttendance(student.id, date, "absent", event.target.value.trim() || "其他");
    persistState();
  });

  customReasonInput.addEventListener("change", () => {
    if (customReasonInput.value.trim()) persistAndRender();
  });

  return card;
}

function activateReasonButton(panel, reason) {
  panel.querySelectorAll(".reason-chip").forEach((button) => {
    const isActive = button.dataset.reason === reason || (button.dataset.reason === "其他" && reason && (reason === "其他" || !defaultAbsenceReasons.includes(reason)));
    button.classList.toggle("active", isActive);
  });
}

function handleTodayStudentRecordOpen(student, card) {
  const now = Date.now();
  const isConfirmed = pendingTodayRecordOpen?.id === student.id && now - pendingTodayRecordOpen.time < 1600;
  tactileFeedback(isConfirmed ? "success" : "tap");
  if (!isConfirmed) {
    pendingTodayRecordOpen = { id: student.id, time: now };
    if (card) {
      card.classList.add("awaiting-record-open");
      setTimeout(() => card.classList.remove("awaiting-record-open"), 1600);
    }
    showToast(`再点一次进入 ${student.name} 的记录`);
    return;
  }
  if (card) card.classList.remove("awaiting-record-open");
  pendingTodayRecordOpen = null;
  openStudentRecords(student);
}

function openStudentRecords(student) {
  const classId = getClassById(student.classId)?.id || "";
  selectedStudentId = student.id;
  elements.recordsClassFilter.value = classId;
  syncStudentOptions(elements.recordsClassFilter, elements.recordsStudentFilter, student.id);
  switchView("records");
  renderRecordsView();
}

function tactileFeedback(type = "tap") {
  const pattern = type === "success" ? 18 : type === "warning" ? [12, 24, 12] : 10;
  if (navigator.vibrate) navigator.vibrate(pattern);
  playFeedbackTone(type);
}

function playFeedbackTone(type = "tap") {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    feedbackAudioContext ||= new AudioContext();
    const ctx = feedbackAudioContext;
    if (ctx.state === "suspended") ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.value = type === "success" ? 740 : type === "warning" ? 420 : 560;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  } catch {
    // Audio feedback is optional; haptics and visual toast still work.
  }
}

function showToast(message) {
  if (!elements.appToast) return;
  elements.appToast.textContent = message;
  elements.appToast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.appToast.classList.add("hidden"), 1500);
}

function openStudentDialog(studentId = "") {
  populateClassOptions();
  if (studentId) {
    const student = state.students.find((item) => item.id === studentId);
    elements.studentDialogTitle.textContent = "编辑学员";
    elements.studentIdInput.value = student.id;
    elements.studentNameInput.value = student.name;
    elements.studentClassInput.value = student.classId;
    elements.studentPackageInput.value = student.packageTotal || "";
    elements.studentLessonTotalInput.value = getStudentLessonTotal(student.id) || "";
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
    packageTotal: Number(elements.studentPackageInput.value) > 0 ? Number(elements.studentPackageInput.value) : "",
    lessonTotal: Number(elements.studentLessonTotalInput.value) >= 0 ? Number(elements.studentLessonTotalInput.value) : 0,
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
    editingClassDates = [...(classItem.dates || [])].sort();
    editingClassCalendarMonth = getClassCalendarMonth(classItem.id);
  } else {
    elements.classDialogTitle.textContent = "新增班级";
    elements.classForm.reset();
    elements.classIdInput.value = "";
    elements.deleteClassButton.classList.add("hidden");
    editingClassDates = [];
    editingClassCalendarMonth = todayIso().slice(0, 7);
  }
  elements.classDateInput.value = "";
  renderEditingClassScheduleTools();
  elements.classDialog.showModal();
}

function saveClass(event) {
  event.preventDefault();
  const id = elements.classIdInput.value;
  if (!elements.classNameInput.value.trim()) return;

  const payload = {
    id: id || crypto.randomUUID(),
    name: elements.classNameInput.value.trim(),
    dates: [...new Set(editingClassDates)].sort(),
  };
  const index = state.classes.findIndex((item) => item.id === payload.id);
  if (index >= 0) state.classes[index] = payload;
  else state.classes.push(payload);

  elements.classDialog.close();
  persistAndRender();
}

function addEditingClassDate() {
  const value = elements.classDateInput.value;
  if (!value || editingClassDates.includes(value)) return;
  editingClassDates.push(value);
  editingClassDates.sort();
  editingClassCalendarMonth = value.slice(0, 7);
  elements.classDateInput.value = "";
  renderEditingClassScheduleTools();
}

function renderEditingClassScheduleTools() {
  renderEditingClassCalendar();
  renderEditingClassDates();
}

function renderEditingClassCalendar() {
  const pseudoClass = {
    id: elements.classIdInput.value || "draft-class",
    name: elements.classNameInput.value.trim() || "新班级",
    dates: editingClassDates,
  };
  elements.classCalendarMonthLabel.textContent = formatMonthLabel(editingClassCalendarMonth);
  elements.classScheduleCalendar.innerHTML = buildClassScheduleCalendar(pseudoClass, editingClassCalendarMonth, "dialog", false);
  elements.classScheduleCalendar.querySelectorAll("[data-dialog-date]").forEach((button) => {
    button.addEventListener("click", () => {
      handleEditingClassDateToggle(button.dataset.dialogDate, button);
    });
  });
}

function renderEditingClassDates() {
  elements.classDatesList.innerHTML = editingClassDates.length
    ? editingClassDates.map((date) => `
      <button class="date-chip" type="button" data-remove-class-date="${date}">
        <span>${escapeHtml(date)}</span>
        <strong>删除</strong>
      </button>
    `).join("")
    : `<p class="student-meta">还没有排课日期，可以先保存班级，之后再回来补日期。</p>`;

  elements.classDatesList.querySelectorAll("[data-remove-class-date]").forEach((button) => {
    button.addEventListener("click", () => {
      editingClassDates = editingClassDates.filter((date) => date !== button.dataset.removeClassDate);
      renderEditingClassScheduleTools();
    });
  });
}

function toggleEditingClassDate(date) {
  if (editingClassDates.includes(date)) {
    editingClassDates = editingClassDates.filter((item) => item !== date);
  } else {
    editingClassDates.push(date);
    editingClassDates.sort();
  }
  renderEditingClassScheduleTools();
}

function handleEditingClassDateToggle(date, button) {
  const isActive = editingClassDates.includes(date);
  const action = isActive ? "取消" : "点亮";
  if (!confirmDateToggle(`dialog:${date}`, button, `再点一次${action} ${formatShortDate(date)}`)) return;
  toggleEditingClassDate(date);
}

function shiftEditingClassMonth(delta) {
  editingClassCalendarMonth = shiftMonth(editingClassCalendarMonth, delta);
  renderEditingClassCalendar();
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

function switchView(target) {
  elements.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.view === target));
  elements.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.target === target));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialData);
    const parsed = JSON.parse(raw);
    if (!isValidStateData(parsed)) throw new Error("invalid");
    return migrateState(parsed);
  } catch {
    return structuredClone(initialData);
  }
}

function isValidStateData(data) {
  return Boolean(data)
    && Array.isArray(data.classes)
    && Array.isArray(data.students)
    && Array.isArray(data.attendance);
}

function migrateState(data) {
  const attendance = (data.attendance || []).map((record) => ({ ...record }));
  return {
    classes: data.classes.map((classItem) => ({
      ...classItem,
      dates: normalizeClassDates(classItem),
    })),
    students: data.students.map((student) => ({
      ...student,
      packageTotal: normalizeOptionalNumber(student.packageTotal),
      lessonTotal: normalizeStudentLessonTotal(student, attendance),
    })),
    attendance,
    cellStyles: Array.isArray(data.cellStyles)
      ? data.cellStyles.filter((item) => item && item.studentId && isIsoDate(item.date) && item.color === "blue")
      : [],
  };
}

function normalizeOptionalNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : "";
}

function normalizeStudentLessonTotal(student, attendance) {
  const stored = Number(student.lessonTotal);
  if (Number.isFinite(stored) && stored >= 0) return stored;
  const presentRecords = attendance.filter((record) => record.studentId === student.id && record.status === "present");
  const manualMax = presentRecords.reduce((max, record) => {
    const number = Number(record.lessonNumber);
    return Number.isFinite(number) && number > 0 ? Math.max(max, number) : max;
  }, 0);
  return manualMax || presentRecords.length || 0;
}

function normalizeClassDates(classItem) {
  if (Array.isArray(classItem.dates)) {
    return [...new Set(classItem.dates.filter(isIsoDate))].sort();
  }
  if (Array.isArray(classItem.schedule)) {
    return generateDatesForWeekdays(classItem.schedule);
  }
  return [];
}

function persistState() {
  const snapshot = createStateSnapshot();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // IndexedDB backup below is the fallback when localStorage is temporarily unavailable.
  }
  saveStableBackup(snapshot);
}

function persistAndRender() {
  persistState();
  renderAll();
}

function createStateSnapshot() {
  return JSON.parse(JSON.stringify(state));
}

function hasValidLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? isValidStateData(JSON.parse(raw)) : false;
  } catch {
    return false;
  }
}

async function restoreStableBackupIfNeeded() {
  if (hasValidLocalState()) {
    saveStableBackup();
    return;
  }

  const backup = await readStableBackup();
  if (!isValidStateData(backup)) {
    saveStableBackup();
    return;
  }

  const migrated = migrateState(backup);
  state.classes = migrated.classes;
  state.students = migrated.students;
  state.attendance = migrated.attendance;
  state.cellStyles = migrated.cellStyles;
  selectedStudentId = null;
  persistState();
  renderAll();
}

function saveStableBackup(snapshot = createStateSnapshot()) {
  openStableBackupDb()
    .then((db) => {
      const tx = db.transaction(STABLE_BACKUP_STORE, "readwrite");
      const store = tx.objectStore(STABLE_BACKUP_STORE);
      const savedAt = new Date().toISOString();
      store.put({
        id: STABLE_BACKUP_ID,
        data: snapshot,
        savedAt,
      });
      store.put({
        id: `snapshot-${savedAt}`,
        data: snapshot,
        savedAt,
      });
      return waitForTransaction(tx);
    })
    .then(() => pruneStableBackups())
    .catch(() => {});
}

function readStableBackup() {
  return openStableBackupDb()
    .then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STABLE_BACKUP_STORE, "readonly");
      const store = tx.objectStore(STABLE_BACKUP_STORE);
      const latestRequest = store.get(STABLE_BACKUP_ID);
      latestRequest.onsuccess = () => {
        const latest = latestRequest.result?.data || null;
        if (isValidStateData(latest)) {
          resolve(latest);
          return;
        }
        const allRequest = store.getAll();
        allRequest.onsuccess = () => {
          const candidates = (allRequest.result || [])
            .filter((item) => item?.id !== STABLE_BACKUP_ID && isValidStateData(item.data))
            .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")));
          resolve(candidates[0]?.data || null);
        };
        allRequest.onerror = () => reject(allRequest.error);
      };
      latestRequest.onerror = () => reject(latestRequest.error);
    }))
    .catch(() => null);
}

function pruneStableBackups() {
  return openStableBackupDb()
    .then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STABLE_BACKUP_STORE, "readwrite");
      const store = tx.objectStore(STABLE_BACKUP_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        (request.result || [])
          .filter((item) => item?.id !== STABLE_BACKUP_ID)
          .sort((a, b) => String(b.savedAt || "").localeCompare(String(a.savedAt || "")))
          .slice(STABLE_BACKUP_LIMIT)
          .forEach((item) => store.delete(item.id));
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }))
    .catch(() => null);
}

function openStableBackupDb() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STABLE_BACKUP_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STABLE_BACKUP_STORE)) {
        db.createObjectStore(STABLE_BACKUP_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function upsertAttendance(studentId, date, status, reason) {
  const existing = state.attendance.find((record) => record.studentId === studentId && record.date === date);
  const previousStatus = existing?.status || "";
  if (existing) {
    adjustStudentLessonTotalForTransition(studentId, previousStatus, status);
    existing.status = status;
    existing.reason = status === "absent" ? reason : "";
    if (status === "present" && previousStatus !== "present") {
      existing.lessonNumber = String(getStudentLessonTotal(studentId));
    }
    if (status !== "present") {
      delete existing.lessonNumber;
    }
    existing.updatedAt = new Date().toISOString();
    return;
  }
  adjustStudentLessonTotalForTransition(studentId, "", status);
  state.attendance.push({
    id: crypto.randomUUID(),
    studentId,
    date,
    status,
    reason: status === "absent" ? reason : "",
    ...(status === "present" ? { lessonNumber: String(getStudentLessonTotal(studentId)) } : {}),
    updatedAt: new Date().toISOString(),
  });
}

function clearAttendance(studentId, date) {
  const existing = getAttendance(studentId, date);
  if (existing) adjustStudentLessonTotalForTransition(studentId, existing.status, "");
  state.attendance = state.attendance.filter((record) => !(record.studentId === studentId && record.date === date));
}

function getAttendance(studentId, date) {
  return state.attendance.find((record) => record.studentId === studentId && record.date === date);
}

function getStudentLessonTotal(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  return Math.max(0, Number(student?.lessonTotal) || 0);
}

function setStudentLessonTotal(studentId, value) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) return;
  const number = Number(value);
  student.lessonTotal = Number.isFinite(number) && number >= 0 ? number : 0;
}

function adjustStudentLessonTotalForTransition(studentId, previousStatus, nextStatus) {
  if (previousStatus === nextStatus) return;
  if (previousStatus !== "present" && nextStatus === "present") {
    setStudentLessonTotal(studentId, getStudentLessonTotal(studentId) + 1);
  } else if (previousStatus === "present" && nextStatus !== "present") {
    setStudentLessonTotal(studentId, Math.max(0, getStudentLessonTotal(studentId) - 1));
  }
}

function getSheetCellColor(studentId, date) {
  return (state.cellStyles || []).find((style) => style.studentId === studentId && style.date === date)?.color || "";
}

function toggleSheetCellBlue(studentId, date) {
  if (!Array.isArray(state.cellStyles)) state.cellStyles = [];
  const index = state.cellStyles.findIndex((style) => style.studentId === studentId && style.date === date);
  if (index >= 0) {
    state.cellStyles.splice(index, 1);
    showToast("已取消浅蓝底色");
  } else {
    state.cellStyles.push({ studentId, date, color: "blue" });
    showToast("已设为浅蓝底色");
  }
}

function updateDisplayedLessonTotal(studentId) {
  if (selectedStudentId && selectedStudentId !== studentId) return;
  const total = getStudentLessonTotal(studentId);
  document.querySelectorAll(".package-progress.lesson-total").forEach((item) => {
    item.textContent = `累计课时：${total}`;
  });
  document.querySelectorAll(".sheet-total-badge").forEach((item) => {
    item.textContent = `累计课时 ${total}`;
  });
}

function getStudentsForAttendanceDate() {
  const date = attendanceDate();
  const classId = elements.attendanceClassFilter.value;
  return state.students
    .filter((student) => student.active !== false)
    .map((student) => ({
      ...student,
      className: getClassById(student.classId)?.name || "未分班",
      classDates: getClassById(student.classId)?.dates || [],
    }))
    .filter((student) => student.classDates.includes(date))
    .filter((student) => !classId || student.classId === classId);
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
    if (!isValidStateData(parsed)) throw new Error("格式不正确");
    const migrated = migrateState(parsed);
    state.classes = migrated.classes;
    state.students = migrated.students;
    state.attendance = migrated.attendance;
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
      const [className, studentName, datesText = ""] = parseCsvLine(row);
      if (!className || !studentName) return;
      let classItem = state.classes.find((item) => item.name === className.trim());
      if (!classItem) {
        classItem = {
          id: crypto.randomUUID(),
          name: className.trim(),
          dates: parseClassDatesText(datesText),
        };
        state.classes.push(classItem);
      } else if (datesText.trim()) {
        classItem.dates = [...new Set([...(classItem.dates || []), ...parseClassDatesText(datesText)])].sort();
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

function parseClassDatesText(text) {
  const matches = text.match(/\d{4}-\d{1,2}-\d{1,2}/g) || [];
  const normalized = matches
    .map((match) => {
      const [year, month, day] = match.split("-").map(Number);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    })
    .filter(isIsoDate);
  return [...new Set(normalized)].sort();
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
  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    elements.installButton.classList.remove("hidden");
  });
}

function setupDurableStorage() {
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }
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
    navigator.serviceWorker.register("./sw.js")
      .then((registration) => registration.update?.())
      .catch(() => {});
  }
}

function setDefaultRangeInputs() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const currentMonth = `${now.getFullYear()}-${month}`;
  elements.attendanceDateInput.value = todayIso();
  elements.recordsStartMonthInput.value = currentMonth;
  elements.recordsEndMonthInput.value = currentMonth;
  elements.reportStartMonthInput.value = currentMonth;
  elements.reportEndMonthInput.value = currentMonth;
}

function populateFilterOptions() {
  fillClassSelect(elements.attendanceClassFilter, elements.attendanceClassFilter.value);
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
      const scheduledDates = getScheduledDatesBetween(startDate, endDate, classItem?.dates || []);
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

function buildAttendanceDetailRows(rows, startDate, endDate) {
  const output = [];
  rows.forEach((row) => {
    const student = state.students.find((item) => item.id === row.studentId);
    const classItem = getClassById(student?.classId);
    const scheduledDates = getScheduledDatesBetween(startDate, endDate, classItem?.dates || []);
    const scheduledSet = new Set(scheduledDates);
    const recordedDates = state.attendance
      .filter((record) => record.studentId === row.studentId && record.date >= startDate && record.date <= endDate)
      .map((record) => record.date);
    [...new Set([...scheduledDates, ...recordedDates])].sort().forEach((date) => {
      const record = getAttendance(row.studentId, date);
      output.push({
        date,
        className: row.className,
        studentName: row.studentName,
        studentId: row.studentId,
        scheduled: scheduledSet.has(date),
        status: record?.status || "",
        reason: record?.reason || "",
      });
    });
  });
  return output.sort((a, b) => a.date.localeCompare(b.date) || a.className.localeCompare(b.className, "zh-Hans-CN") || a.studentName.localeCompare(b.studentName, "zh-Hans-CN"));
}

function buildStudentSpreadsheetTable(student, startDate, endDate) {
  const classItem = getClassById(student.classId);
  const scheduledDates = getScheduledDatesBetween(startDate, endDate, classItem?.dates || []);
  const recordedDates = state.attendance
    .filter((record) => record.studentId === student.id && record.date >= startDate && record.date <= endDate)
    .map((record) => record.date);
  const styledDates = (state.cellStyles || [])
    .filter((style) => style.studentId === student.id && style.date >= startDate && style.date <= endDate)
    .map((style) => style.date);
  const dates = [...new Set([...scheduledDates, ...recordedDates, ...styledDates])].sort();
  const presentNumbers = buildPresentLessonNumbers(student.id);

  return `
    <div class="table-wrap sheet-table-wrap">
      <table class="sheet-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>星期</th>
            <th class="student-column">${escapeHtml(student.name)}</th>
          </tr>
        </thead>
        <tbody>
          ${dates.length ? dates.map((date) => {
            const record = getAttendance(student.id, date);
            const isAbsent = record?.status === "absent";
            const isPresent = record?.status === "present";
            const isBlue = getSheetCellColor(student.id, date) === "blue";
            const value = isPresent ? String(record?.lessonNumber || presentNumbers.get(date) || "") : isAbsent ? record.reason || "请假" : "";
            return `
              <tr>
                <td class="date-col">${escapeHtml(formatShortDate(date))}</td>
                <td>${escapeHtml(shortWeekday(date))}</td>
                <td class="student-sheet-cell ${isAbsent ? "absent" : isPresent ? "present" : "pending"} ${isBlue ? "blue-highlight" : ""}" data-sheet-status="${student.id}" data-date="${date}">
                  <button class="sheet-color-toggle ${isBlue ? "active" : ""}" type="button" data-sheet-color="${student.id}" data-date="${date}" aria-label="切换红色或蓝色底色" title="切换底色"></button>
                  ${isPresent
                    ? `<input class="sheet-lesson-input" type="text" inputmode="numeric" value="${escapeAttribute(value)}" data-sheet-lesson="${student.id}" data-date="${date}" aria-label="课次数字">`
                    : isAbsent
                      ? `<input class="sheet-reason-input compact-reason" type="text" value="${escapeAttribute(record.reason || "请假")}" data-sheet-reason="${student.id}" data-date="${date}" aria-label="缺勤原因">`
                      : `<span class="sheet-status-label">${escapeHtml(value || "待补录")}</span>`}
                </td>
              </tr>
            `;
          }).join("") : `<tr><td colspan="3">当前范围内没有该学员的课日或考勤记录。</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function buildPresentLessonNumbers(studentId) {
  let count = 0;
  const numbers = new Map();
  state.attendance
    .filter((record) => record.studentId === studentId && record.status === "present")
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((record) => {
      count += 1;
      numbers.set(record.date, count);
    });
  return numbers;
}

function getStudentPackageProgress(studentId) {
  const student = state.students.find((item) => item.id === studentId);
  const total = Number(student?.packageTotal) || 0;
  const presentNumbers = buildPresentLessonNumbers(studentId);
  const inferredCurrent = state.attendance
    .filter((record) => record.studentId === studentId && record.status === "present")
    .reduce((max, record) => {
      const manual = Number(record.lessonNumber);
      const auto = presentNumbers.get(record.date) || 0;
      return Math.max(max, Number.isFinite(manual) && manual > 0 ? manual : auto);
    }, 0);
  const current = Math.max(getStudentLessonTotal(studentId), inferredCurrent);
  return { current, total };
}

async function saveStudentSheetImage(studentId, startDate, endDate) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) return;
  const blob = await createStudentSheetImageBlob(student, startDate, endDate);
  if (!blob) {
    showToast("图片生成失败，请再试一次");
    return;
  }
  const filename = `${student.name}-课时明细-${startDate}-${endDate}.png`;
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: `${student.name}课时明细` });
      showToast("已打开保存/分享");
      return;
    } catch {
      // Fall back to download when the share sheet is cancelled or unavailable.
    }
  }
  downloadBlob(filename, blob);
  showToast("已生成表格图片");
}

function createStudentSheetImageBlob(student, startDate, endDate) {
  const classItem = getClassById(student.classId);
  const scheduledDates = getScheduledDatesBetween(startDate, endDate, classItem?.dates || []);
  const recordedDates = state.attendance
    .filter((record) => record.studentId === student.id && record.date >= startDate && record.date <= endDate)
    .map((record) => record.date);
  const styledDates = (state.cellStyles || [])
    .filter((style) => style.studentId === student.id && style.date >= startDate && style.date <= endDate)
    .map((style) => style.date);
  const dates = [...new Set([...scheduledDates, ...recordedDates, ...styledDates])].sort();
  const presentNumbers = buildPresentLessonNumbers(student.id);
  const columns = [190, 160, 550];
  const rowHeight = 52;
  const headerHeight = 62;
  const width = columns.reduce((sum, value) => sum + value, 0);
  const height = headerHeight + Math.max(dates.length, 1) * rowHeight;
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  drawSheetCell(ctx, 0, 0, columns[0], headerHeight, "日期", { fill: "#d6dce2", bold: true, size: 30 });
  drawSheetCell(ctx, columns[0], 0, columns[1], headerHeight, "星期", { fill: "#d6dce2", bold: true, size: 30 });
  drawSheetCell(ctx, columns[0] + columns[1], 0, columns[2], headerHeight, student.name, { fill: "#d6dce2", bold: true, size: 30 });
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(columns[0] + columns[1] - 2, 0, 4, height);

  const rows = dates.length ? dates : [""];
  rows.forEach((date, index) => {
    const y = headerHeight + index * rowHeight;
    const record = date ? getAttendance(student.id, date) : null;
    const isAbsent = record?.status === "absent";
    const isPresent = record?.status === "present";
    const isBlue = date ? getSheetCellColor(student.id, date) === "blue" : false;
    const value = isPresent
      ? String(record?.lessonNumber || presentNumbers.get(date) || "")
      : isAbsent
        ? record.reason || "请假"
        : date ? "待补录" : "暂无记录";
    drawSheetCell(ctx, 0, y, columns[0], rowHeight, date ? formatShortDate(date) : "", { fill: "#eef0f3", bold: true, size: 26 });
    drawSheetCell(ctx, columns[0], y, columns[1], rowHeight, date ? shortWeekday(date) : "", { size: 26 });
    drawSheetCell(ctx, columns[0] + columns[1], y, columns[2], rowHeight, value, {
      fill: isBlue ? "#dbeafe" : isAbsent ? "#e6a3a6" : "#ffffff",
      color: isBlue ? "#1e3a8a" : isAbsent ? "#7f1d1d" : isPresent ? "#111827" : "#9aa3ae",
      bold: true,
      size: isAbsent ? 24 : 26,
    });
  });

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
}

function drawSheetCell(ctx, x, y, width, height, text, options = {}) {
  ctx.fillStyle = options.fill || "#ffffff";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.24)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = options.color || "#111827";
  ctx.font = `${options.bold ? 800 : 500} ${options.size || 28}px "PingFang SC", "Noto Sans SC", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text || ""), x + width / 2, y + height / 2, width - 20);
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

function buildStudentMonthCalendar(studentId, monthValue) {
  const safeMonth = monthValue || todayIso().slice(0, 7);
  const [year, month] = safeMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const student = state.students.find((item) => item.id === studentId);
  const classDates = getClassById(student?.classId)?.dates || [];
  const blanks = Array.from({ length: first.getDay() }, () => `<div class="calendar-day blank"></div>`);
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = getAttendance(studentId, date);
    const isScheduled = classDates.includes(date);
    const statusClass = record?.status === "present" ? "present" : record?.status === "absent" ? "absent" : isScheduled ? "scheduled" : "";
    const label = record?.status === "present"
      ? "出勤"
      : record?.status === "absent"
        ? record.reason || "缺勤"
        : isScheduled
          ? "有课"
          : "";
    return `
      <button class="calendar-day ${statusClass} ${isScheduled ? "class-day" : ""}" type="button" data-calendar-attendance="${studentId}" data-date="${date}">
        <strong>${day}</strong>
        ${isScheduled ? `<em>课</em>` : ""}
        ${label ? `<span>${escapeHtml(label)}</span>` : ""}
      </button>
    `;
  });

  return `
    <div class="calendar-grid month-calendar">
      ${["日", "一", "二", "三", "四", "五", "六"].map((day) => `<div class="calendar-weekday">周${day}</div>`).join("")}
      ${[...blanks, ...days].join("")}
    </div>
  `;
}

function getScheduledDatesBetween(startDate, endDate, schedule) {
  return [...new Set(schedule)]
    .filter((date) => date >= startDate && date <= endDate)
    .sort();
}

function buildClassScheduleCalendar(classItem, monthValue, mode = "card", wrap = true) {
  const [year, month] = monthValue.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const dateSet = new Set(classItem.dates || []);
  const students = state.students.filter((student) => student.classId === classItem.id && student.active !== false);
  const blanks = Array.from({ length: first.getDay() }, () => `<div class="calendar-day blank"></div>`);
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isActive = dateSet.has(date);
    const presentCount = students.filter((student) => getAttendance(student.id, date)?.status === "present").length;
    const absentCount = students.filter((student) => getAttendance(student.id, date)?.status === "absent").length;
    const attr = mode === "dialog"
      ? `data-dialog-date="${date}"`
      : `data-toggle-class-date="${classItem.id}" data-date="${date}"`;
    return `
      <button class="calendar-day schedule-day ${isActive ? "selected" : ""}" type="button" ${attr}>
        <strong>${day}</strong>
        ${isActive ? `<span>有课</span>` : ""}
        ${(presentCount || absentCount) ? `<small>${presentCount}到 / ${absentCount}缺</small>` : ""}
      </button>
    `;
  });
  const content = `
    ${["日", "一", "二", "三", "四", "五", "六"].map((day) => `<div class="calendar-weekday">周${day}</div>`).join("")}
    ${[...blanks, ...days].join("")}
  `;
  return wrap ? `<div class="calendar-grid class-schedule-calendar">${content}</div>` : content;
}

function toggleClassDate(classId, date) {
  const classItem = getClassById(classId);
  if (!classItem) return;
  const dates = new Set(classItem.dates || []);
  if (dates.has(date)) dates.delete(date);
  else dates.add(date);
  classItem.dates = [...dates].sort();
  persistAndRender();
}

function handleClassDateToggle(classId, date, button) {
  const classItem = getClassById(classId);
  if (!classItem) return;
  const isActive = (classItem.dates || []).includes(date);
  const action = isActive ? "取消" : "点亮";
  if (!confirmDateToggle(`class:${classId}:${date}`, button, `再点一次${action} ${formatShortDate(date)}`)) return;
  toggleClassDate(classId, date);
}

function confirmDateToggle(key, button, message) {
  const now = Date.now();
  const isConfirmed = pendingClassDateToggle?.key === key && now - pendingClassDateToggle.time < 1600;
  tactileFeedback(isConfirmed ? "success" : "tap");
  if (isConfirmed) {
    pendingClassDateToggle = null;
    if (button) button.classList.remove("awaiting-toggle");
    return true;
  }
  pendingClassDateToggle = { key, time: now };
  if (button) {
    button.classList.add("awaiting-toggle");
    setTimeout(() => button.classList.remove("awaiting-toggle"), 1600);
  }
  showToast(message);
  return false;
}

function getClassCalendarMonth(classId) {
  if (!classCalendarMonths[classId]) classCalendarMonths[classId] = todayIso().slice(0, 7);
  return classCalendarMonths[classId];
}

function getMonthEndDate(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return toIsoDate(new Date(year, month, 0));
}

function getClassById(id) {
  return state.classes.find((item) => item.id === id);
}

function attendanceDate() {
  return elements.attendanceDateInput.value || todayIso();
}

function generateDatesForWeekdays(days) {
  const dates = [];
  const start = new Date();
  start.setDate(1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  const cursor = new Date(start);
  while (cursor <= end) {
    if (days.includes(cursor.getDay())) dates.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatClassDates(dates = []) {
  if (!dates.length) return "未排课";
  const visible = dates.slice(0, 4).join(" / ");
  return dates.length > 4 ? `${visible} 等 ${dates.length} 天` : visible;
}

function getNextClassDate(classItem) {
  const today = todayIso();
  return (classItem.dates || []).find((date) => date >= today) || "";
}

function shiftMonth(monthValue, delta) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function formatShortDate(dateValue) {
  const [, month, day] = dateValue.split("-").map(Number);
  return `${month}.${day}`;
}

function shortWeekday(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return weekdays[date.getDay()];
}

function formatMonthLabel(monthValue) {
  const [year, month] = monthValue.split("-");
  return `${year}年${Number(month)}月`;
}

function getInitial(name) {
  return name.trim().slice(0, 1).toUpperCase();
}

function avatarStyleForStudent(student) {
  return `background:${avatarColorForClass(student.classId)}; color:#334155;`;
}

function avatarColorForClass(classId) {
  const palette = ["#f6dfa2", "#b8e6c8", "#b9d7ff", "#f7c9a6", "#d5c8ff", "#f6b9be"];
  const classIndex = state.classes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))
    .findIndex((classItem) => classItem.id === classId);
  const index = classIndex >= 0 ? classIndex : 0;
  return palette[index % palette.length];
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

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
