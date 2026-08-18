// =====================================================
// نظام إدارة المدرسة - APP.JS
// =====================================================

let currentUser = null;
let activityTimer = null;

// =====================================================
// أدوات عامة
// =====================================================

const $ = (id) => document.getElementById(id);

function showToast(message, type = "success") {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;

  setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "حدث خطأ في الاتصال");
  }

  return data;
}

function formatDate(date) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString("ar-EG");
  } catch {
    return date;
  }
}

// =====================================================
// تسجيل الدخول
// =====================================================

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;

  const message = $("loginMessage");

  message.textContent = "جاري تسجيل الدخول...";
  message.className = "message";

  try {
    const user = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });

    currentUser = user;

    localStorage.setItem(
      "schoolUser",
      JSON.stringify(user)
    );

    $("loginPage").classList.add("hidden");
    $("appPage").classList.remove("hidden");

    $("currentUserName").textContent =
      `${user.name} (${roleName(user.role)})`;

    showToast("تم تسجيل الدخول بنجاح");

    startActivity();

    loadDashboard();

  } catch (error) {
    message.textContent = error.message;
    message.className = "message error";
  }
});

// =====================================================
// الصلاحيات
// =====================================================

function roleName(role) {
  const roles = {
    admin: "مدير",
    teacher: "معلم",
    parent: "ولي أمر",
    student: "طالب"
  };

  return roles[role] || role;
}

function isAdmin() {
  return currentUser?.role === "admin";
}

function applyPermissions() {

  const adminOnlyPages = [
    "users",
    "employees",
    "payroll",
    "logs"
  ];

  document.querySelectorAll(".nav-item").forEach(button => {

    const page = button.dataset.page;

    if (
      adminOnlyPages.includes(page) &&
      !isAdmin()
    ) {
      button.style.display = "none";
    } else {
      button.style.display = "flex";
    }
  });

  if (!isAdmin()) {
    $("addUserButton").style.display = "none";
    $("addEmployeeButton").style.display = "none";
    $("payrollSettingsButton").style.display = "none";
  }
}

// =====================================================
// تسجيل النشاط
// =====================================================

function startActivity() {

  if (activityTimer) {
    clearInterval(activityTimer);
  }

  sendActivity();

  activityTimer = setInterval(() => {
    sendActivity();
  }, 30000);
}

async function sendActivity() {

  if (!currentUser) return;

  try {

    const result = await api("/api/activity", {
      method: "POST",
      body: JSON.stringify({
        user_id: currentUser.id
      })
    });

    if (result.last_seen) {
      $("onlineIndicator").textContent = "● متصل";
    }

  } catch (error) {

    console.error(error);

    $("onlineIndicator").textContent =
      "● غير متصل";
  }
}

// =====================================================
// تسجيل الخروج
// =====================================================

$("logoutButton").addEventListener("click", () => {

  currentUser = null;

  localStorage.removeItem("schoolUser");

  if (activityTimer) {
    clearInterval(activityTimer);
  }

  $("appPage").classList.add("hidden");
  $("loginPage").classList.remove("hidden");

  $("username").value = "";
  $("password").value = "";

  showToast("تم تسجيل الخروج");
});

// =====================================================
// التنقل
// =====================================================

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    const page = button.dataset.page;

    document.querySelectorAll(".nav-item")
      .forEach(item => item.classList.remove("active"));

    button.classList.add("active");

    document.querySelectorAll(".page-section")
      .forEach(section => section.classList.add("hidden"));

    const target = $(`page-${page}`);

    if (target) {
      target.classList.remove("hidden");
    }

    loadPage(page);

    if (window.innerWidth <= 900) {
      $("sidebar").classList.remove("open");
    }
  });
});

// =====================================================
// القائمة في الهاتف
// =====================================================

$("menuButton").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

// =====================================================
// تحميل الصفحات
// =====================================================

function loadPage(page) {

  switch (page) {

    case "dashboard":
      loadDashboard();
      break;

    case "users":
      loadUsers();
      break;

    case "students":
      loadStudents();
      break;

    case "employees":
      loadEmployees();
      break;

    case "attendance":
      loadAttendance();
      break;

    case "payroll":
      loadPayroll();
      break;

    case "notes":
      loadNotes();
      loadNoteStudents();
      break;

    case "videos":
      loadVideos();
      break;

    case "logs":
      loadLogs();
      break;
  }
}

// =====================================================
// Dashboard
// =====================================================

async function loadDashboard() {

  try {

    const [
      users,
      students,
      employees,
      health
    ] = await Promise.all([
      api("/api/users"),
      api("/api/students"),
      api("/api/employees"),
      api("/api/health")
    ]);

    $("statUsers").textContent =
      users.total || 0;

    $("statOnline").textContent =
      users.online_count || 0;

    $("statStudents").textContent =
      students.length || 0;

    $("statEmployees").textContent =
      employees.length || 0;

    $("healthStatus").innerHTML = `
      <div class="status-success">
        🟢 النظام يعمل بشكل طبيعي
      </div>
      <div>
        آخر فحص: ${escapeHTML(formatDate(health.time))}
      </div>
    `;

    const onlineUsers =
      users.users.filter(user => user.online);

    if (!onlineUsers.length) {

      $("onlineUsersList").innerHTML =
        "لا يوجد مستخدمون متصلون الآن";

    } else {

      $("onlineUsersList").innerHTML =
        onlineUsers.map(user => `
          <div class="online-user">
            <span>🟢</span>
            <strong>${escapeHTML(user.name)}</strong>
            <small>${escapeHTML(roleName(user.role))}</small>
          </div>
        `).join("");
    }

  } catch (error) {

    console.error(error);

    $("healthStatus").innerHTML =
      `<span class="error-text">${escapeHTML(error.message)}</span>`;
  }
}

$("refreshDashboard").addEventListener(
  "click",
  loadDashboard
);

// =====================================================
// المستخدمون
// =====================================================

async function loadUsers() {

  try {

    const data = await api("/api/users");

    $("usersTotal").textContent =
      data.total;

    $("usersActive").textContent =
      data.active_count;

    $("usersOnline").textContent =
      data.online_count;

    const body = $("usersTableBody");

    body.innerHTML = data.users.map((user, index) => {

      const status = user.active
        ? `<span class="badge success">نشط</span>`
        : `<span class="badge danger">موقوف</span>`;

      const online = user.online
        ? `<span class="online-badge">● متصل</span>`
        : `<span class="offline-badge">● غير متصل</span>`;

      let actions = "";

      if (user.username !== "admin") {

        actions += user.active
          ? `
            <button
              class="btn btn-warning btn-small"
              onclick="disableUser(${user.id})">
              إيقاف
            </button>
          `
          : `
            <button
              class="btn btn-success btn-small"
              onclick="enableUser(${user.id})">
              تفعيل
            </button>
          `;

        actions += `
          <button
            class="btn btn-danger btn-small"
            onclick="deleteUser(${user.id})">
            حذف
          </button>
        `;
      }

      return `
        <tr>

          <td>${index + 1}</td>

          <td>
            <strong>${escapeHTML(user.username)}</strong>
          </td>

          <td>
            ${escapeHTML(user.name)}
          </td>

          <td>
            ${escapeHTML(roleName(user.role))}
          </td>

          <td>
            ${status}
            ${online}
          </td>

          <td>
            ${formatDate(user.last_seen)}
          </td>

          <td>
            ${actions}
          </td>

        </tr>
      `;

    }).join("");

  } catch (error) {
    showToast(error.message, "error");
  }
}

// =====================================================
// إضافة مستخدم
// =====================================================

$("addUserButton").addEventListener("click", () => {

  openModal(
    "إضافة مستخدم",
    `
      <form id="userForm">

        <div class="form-group">
          <label>اسم المستخدم</label>
          <input id="newUsername" required>
        </div>

        <div class="form-group">
          <label>الاسم</label>
          <input id="newName" required>
        </div>

        <div class="form-group">
          <label>كلمة المرور</label>
          <input id="newPassword" type="password" required>
        </div>

        <div class="form-group">
          <label>الصلاحية</label>

          <select id="newRole">

            <option value="admin">مدير</option>
            <option value="teacher">معلم</option>
            <option value="parent">ولي أمر</option>
            <option value="student">طالب</option>

          </select>

        </div>

        <button class="btn btn-primary" type="submit">
          حفظ المستخدم
        </button>

      </form>
    `
  );

  $("userForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: $("newUsername").value.trim(),
          name: $("newName").value.trim(),
          password: $("newPassword").value,
          role: $("newRole").value
        })
      });

      closeModal();

      showToast("تم إضافة المستخدم");

      loadUsers();
      loadDashboard();

    } catch (error) {

      showToast(error.message, "error");
    }
  });
});

async function disableUser(id) {

  if (!confirm("هل تريد إيقاف هذا المستخدم؟")) return;

  try {

    await api(`/api/users/${id}/disable`, {
      method: "PATCH"
    });

    showToast("تم إيقاف المستخدم");

    loadUsers();
    loadDashboard();

  } catch (error) {
    showToast(error.message, "error");
  }
}

async function enableUser(id) {

  try {

    await api(`/api/users/${id}/enable`, {
      method: "PATCH"
    });

    showToast("تم تفعيل المستخدم");

    loadUsers();
    loadDashboard();

  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteUser(id) {

  if (!confirm("هل أنت متأكد من حذف المستخدم؟")) return;

  try {

    await api(`/api/users/${id}`, {
      method: "DELETE"
    });

    showToast("تم حذف المستخدم");

    loadUsers();
    loadDashboard();

  } catch (error) {
    showToast(error.message, "error");
  }
}

// =====================================================
// الطلاب
// =====================================================

async function loadStudents() {

  try {

    const students = await api("/api/students");

    $("studentsTableBody").innerHTML =
      students.map((student, index) => `

        <tr>

          <td>${index + 1}</td>

          <td>
            <strong>${escapeHTML(student.name)}</strong>
          </td>

          <td>
            ${escapeHTML(student.class_name)}
          </td>

          <td>
            ${escapeHTML(student.parent_phone || "-")}
          </td>

          <td>
            ${
              student.status === "حاضر"
                ? `<span class="badge success">حاضر</span>`
                : `<span class="badge danger">غائب</span>`
            }
          </td>

          <td>

            <button
              class="btn btn-secondary btn-small"
              onclick="toggleStudentStatus(${student.id})">
              تغيير الحالة
            </button>

            <button
              class="btn btn-primary btn-small"
              onclick="showStudentAttendance(${student.id})">
              السجل
            </button>

          </td>

        </tr>

      `).join("");

  } catch (error) {

    showToast(error.message, "error");
  }
}

$("addStudentButton").addEventListener("click", () => {

  openModal(
    "إضافة طالب",
    `
      <form id="studentForm">

        <div class="form-group">
          <label>اسم الطالب</label>
          <input id="studentName" required>
        </div>

        <div class="form-group">
          <label>الفصل</label>
          <input id="studentClass" required>
        </div>

        <div class="form-group">
          <label>هاتف ولي الأمر</label>
          <input id="parentPhone">
        </div>

        <button class="btn btn-primary">
          إضافة الطالب
        </button>

      </form>
    `
  );

  $("studentForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    try {

      await api("/api/students", {
        method: "POST",
        body: JSON.stringify({
          name: $("studentName").value.trim(),
          class_name: $("studentClass").value.trim(),
          parent_phone: $("parentPhone").value.trim()
        })
      });

      closeModal();

      showToast("تم إضافة الطالب");

      loadStudents();
      loadDashboard();

    } catch (error) {

      showToast(error.message, "error");
    }
  });
});

async function toggleStudentStatus(id) {

  try {

    await api(`/api/students/${id}/status`, {
      method: "PATCH"
    });

    showToast("تم تحديث حالة الطالب");

    loadStudents();

  } catch (error) {

    showToast(error.message, "error");
  }
}

async function showStudentAttendance(id) {

  try {

    const data =
      await api(`/api/students/${id}/attendance`);

    openModal(
      "سجل حضور الطالب",
      `
        <div class="attendance-summary">

          <div>
            <strong>${data.total}</strong>
            <span>إجمالي</span>
          </div>

          <div>
            <strong>${data.present}</strong>
            <span>حاضر</span>
          </div>

          <div>
            <strong>${data.absent}</strong>
            <span>غائب</span>
          </div>

          <div>
            <strong>${data.percentage}%</strong>
            <span>النسبة</span>
          </div>

        </div>

        <div class="table-wrapper">

          <table>

            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الحالة</th>
              </tr>
            </thead>

            <tbody>

              ${
                data.records.map(record => `
                  <tr>
                    <td>${escapeHTML(record.date)}</td>
                    <td>${escapeHTML(record.status)}</td>
                  </tr>
                `).join("")
              }

            </tbody>

          </table>

        </div>
      `
    );

  } catch (error) {

    showToast(error.message, "error");
  }
}

// =====================================================
// الحضور
// =====================================================

async function loadAttendance() {

  await loadStudentAttendance();

  await loadEmployeeAttendance();
}

async function loadStudentAttendance() {

  try {

    const students =
      await api("/api/students");

    $("attendanceStudentsBody").innerHTML =
      students.map(student => `

        <tr>

          <td>${escapeHTML(student.name)}</td>

          <td>${escapeHTML(student.class_name)}</td>

          <td>
            ${
              student.status === "حاضر"
                ? `<span class="badge success">حاضر</span>`
                : `<span class="badge danger">غائب</span>`
            }
          </td>

          <td>

            <button
              class="btn btn-primary btn-small"
              onclick="toggleStudentStatus(${student.id})">
              تغيير
            </button>

          </td>

        </tr>

      `).join("");

  } catch (error) {

    showToast(error.message, "error");
  }
}

async function loadEmployeeAttendance() {

  try {

    const employees =
      await api("/api/employees");

    let rows = "";

    for (const employee of employees) {

      const data =
        await api(`/api/employees/${employee.id}/attendance`);

      const latest =
        data.records?.[0];

      if (!latest) {

        rows += `
          <tr>
            <td>${escapeHTML(employee.name)}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>لا يوجد سجل</td>
            <td>-</td>
          </tr>
        `;

        continue;
      }

      rows += `
        <tr>

          <td>${escapeHTML(employee.name)}</td>

          <td>${escapeHTML(latest.date)}</td>

          <td>${escapeHTML(latest.check_in || "-")}</td>

          <td>${escapeHTML(latest.check_out || "-")}</td>

          <td>${escapeHTML(latest.status)}</td>

          <td>${latest.late_minutes || 0} دقيقة</td>

        </tr>
      `;
    }

    $("attendanceEmployeesBody").innerHTML = rows;

  } catch (error) {

    showToast(error.message, "error");
  }
}

$("refreshStudentAttendance").addEventListener(
  "click",
  loadAttendance
);

document.querySelectorAll(".attendance-tab")
  .forEach(tab => {

    tab.addEventListener("click", () => {

      document.querySelectorAll(".attendance-tab")
        .forEach(x => x.classList.remove("active"));

      tab.classList.add("active");

      const type =
        tab.dataset.attendanceType;

      if (type === "students") {

        $("studentAttendancePanel")
          .classList.remove("hidden");

        $("employeeAttendancePanel")
          .classList.add("hidden");

      } else {

        $("studentAttendancePanel")
          .classList.add("hidden");

        $("employeeAttendancePanel")
          .classList.remove("hidden");

        loadEmployeeAttendance();
      }
    });
  });

// =====================================================
// الموظفون
// =====================================================

async function loadEmployees() {

  try {

    const employees =
      await api("/api/employees");

    $("employeesTableBody").innerHTML =
      employees.map((employee, index) => `

        <tr>

          <td>${index + 1}</td>

          <td>${escapeHTML(employee.employee_number || "-")}</td>

          <td>
            <strong>${escapeHTML(employee.name)}</strong>
          </td>

          <td>${escapeHTML(employee.job_title || "-")}</td>

          <td>${escapeHTML(employee.department || "-")}</td>

          <td>${escapeHTML(employee.phone || "-")}</td>

          <td>
            ${Number(employee.basic_salary || 0) +
              Number(employee.allowance || 0)}
          </td>

          <td>
            ${
              employee.active
                ? `<span class="badge success">نشط</span>`
                : `<span class="badge danger">موقوف</span>`
            }
          </td>

          <td>

            <button
              class="btn btn-primary btn-small"
              onclick="employeeAttendance(${employee.id})">
              حضور
            </button>

            <button
              class="btn btn-secondary btn-small"
              onclick="employeePayroll(${employee.id})">
              راتب
            </button>

          </td>

        </tr>

      `).join("");

  } catch (error) {

    showToast(error.message, "error");
  }
}

// =====================================================
// إضافة موظف
// =====================================================

$("addEmployeeButton").addEventListener("click", () => {

  openModal(
    "إضافة موظف",
    `
      <form id="employeeForm">

        <div class="form-group">
          <label>رقم الموظف</label>
          <input id="employeeNumber">
        </div>

        <div class="form-group">
          <label>اسم الموظف</label>
          <input id="employeeName" required>
        </div>

        <div class="form-group">
          <label>الوظيفة</label>
          <input id="employeeJob">
        </div>

        <div class="form-group">
          <label>القسم</label>
          <input id="employeeDepartment">
        </div>

        <div class="form-group">
          <label>الهاتف</label>
          <input id="employeePhone">
        </div>

        <div class="form-group">
          <label>تاريخ التعيين</label>
          <input id="hireDate" type="date">
        </div>

        <div class="form-group">
          <label>الراتب الأساسي</label>
          <input id="basicSalary" type="number" min="0">
        </div>

        <div class="form-group">
          <label>البدل</label>
          <input id="allowance" type="number" min="0">
        </div>

        <button class="btn btn-primary">
          حفظ الموظف
        </button>

      </form>
    `
  );

  $("employeeForm").addEventListener("submit", async e => {

    e.preventDefault();

    try {

      await api("/api/employees", {
        method: "POST",
        body: JSON.stringify({

          employee_number:
            $("employeeNumber").value.trim(),

          name:
            $("employeeName").value.trim(),

          job_title:
            $("employeeJob").value.trim(),

          department:
            $("employeeDepartment").value.trim(),

          phone:
            $("employeePhone").value.trim(),

          hire_date:
            $("hireDate").value,

          basic_salary:
            Number($("basicSalary").value || 0),

          allowance:
            Number($("allowance").value || 0)
        })
      });

      closeModal();

      showToast("تم إضافة الموظف");

      loadEmployees();
      loadDashboard();

    } catch (error) {

      showToast(error.message, "error");
    }
  });
});

async function employeeAttendance(id) {

  openModal(
    "تسجيل حضور موظف",
    `
      <form id="employeeAttendanceForm">

        <div class="form-group">
          <label>التاريخ</label>
          <input id="attendanceDate" type="date" value="${new Date().toISOString().slice(0,10)}">
        </div>

        <div class="form-group">
          <label>وقت الدخول</label>
          <input id="checkIn" type="time">
        </div>

        <div class="form-group">
          <label>وقت الخروج</label>
          <input id="checkOut" type="time">
        </div>

        <div class="form-group">
          <label>الحالة</label>

          <select id="employeeStatus">

            <option value="حاضر">حاضر</option>
            <option value="غائب">غائب</option>

          </select>

        </div>

        <button class="btn btn-primary">
          حفظ الحضور
        </button>

      </form>
    `
  );

  $("employeeAttendanceForm")
    .addEventListener("submit", async e => {

      e.preventDefault();

      try {

        const result =
          await api(`/api/employees/${id}/attendance`, {
            method: "POST",
            body: JSON.stringify({

              date: $("attendanceDate").value,

              check_in:
                $("checkIn").value || null,

              check_out:
                $("checkOut").value || null,

              status:
                $("employeeStatus").value
            })
          });

        closeModal();

        showToast(
          `تم تسجيل الحضور - ${result.status}`
        );

        loadAttendance();

      } catch (error) {

        showToast(error.message, "error");
      }
    });
}

// =====================================================
// الرواتب
// =====================================================

async function loadPayroll() {

  try {

    const employees =
      await api("/api/employees");

    const month =
      new Date().toISOString().slice(0, 7);

    let rows = "";

    for (const employee of employees) {

      const payroll =
        await api(
          `/api/employees/${employee.id}/payroll?month=${month}`
        );

      rows += `

        <tr>

          <td>
            ${escapeHTML(employee.name)}
          </td>

          <td>
            ${payroll.basic_salary}
          </td>

          <td>
            ${payroll.allowance}
          </td>

          <td>
            ${payroll.bonuses}
          </td>

          <td>
            ${payroll.deductions}
          </td>

          <td>
            <strong>
              ${payroll.net}
            </strong>
          </td>

          <td>

            <button
              class="btn btn-primary btn-small"
              onclick="employeePayroll(${employee.id})">
              التفاصيل
            </button>

          </td>

        </tr>
      `;
    }

    $("payrollTableBody").innerHTML = rows;

  } catch (error) {

    showToast(error.message, "error");
  }
}

async function employeePayroll(id) {

  try {

    const month =
      new Date().toISOString().slice(0, 7);

    const data =
      await api(
        `/api/employees/${id}/payroll?month=${month}`
      );

    openModal(
      "كشف راتب الموظف",
      `
        <div class="payroll-details">

          <h3>
            ${escapeHTML(data.employee.name)}
          </h3>

          <p>
            الشهر: ${escapeHTML(data.month)}
          </p>

          <hr>

          <p>
            الأساسي:
            <strong>${data.basic_salary}</strong>
          </p>

          <p>
            البدلات:
            <strong>${data.allowance}</strong>
          </p>

          <p>
            المكافآت:
            <strong>${data.bonuses}</strong>
          </p>

          <p>
            الخصومات:
            <strong>${data.deductions}</strong>
          </p>

          <hr>

          <h2>
            صافي الراتب:
            ${data.net}
          </h2>

        </div>
      `
    );

  } catch (error) {

    showToast(error.message, "error");
  }
}

$("payrollSettingsButton").addEventListener(
  "click",
  async () => {

    try {

      const settings =
        await api("/api/payroll-settings");

      openModal(
        "إعدادات الرواتب",
        `
          <form id="payrollSettingsForm">

            <div class="form-group">

              <label>
                خصم الغياب
              </label>

              <input
                id="absenceDeduction"
                type="number"
                value="${settings.absence_deduction}"
              >

            </div>

            <div class="form-group">

              <label>
                خصم التأخير
              </label>

              <input
                id="lateDeduction"
                type="number"
                value="${settings.late_deduction}"
              >

            </div>

            <div class="form-group">

              <label>
                الدقائق المسموحة للتأخير
              </label>

              <input
                id="allowedLate"
                type="number"
                value="${settings.allowed_late_minutes}"
              >

            </div>

            <button class="btn btn-primary">
              حفظ الإعدادات
            </button>

          </form>
        `
      );

      $("payrollSettingsForm")
        .addEventListener("submit", async e => {

          e.preventDefault();

          try {

            await api("/api/payroll-settings", {
              method: "PATCH",
              body: JSON.stringify({

                absence_deduction:
                  Number($("absenceDeduction").value),

                late_deduction:
                  Number($("lateDeduction").value),

                allowed_late_minutes:
                  Number($("allowedLate").value)
              })
            });

            closeModal();

            showToast("تم تحديث إعدادات الرواتب");

            loadPayroll();

          } catch (error) {

            showToast(error.message, "error");
          }
        });

    } catch (error) {

      showToast(error.message, "error");
    }
  }
);

// =====================================================
// الملاحظات
// =====================================================

async function loadNoteStudents() {

  try {

    const students =
      await api("/api/students");

    $("noteStudent").innerHTML = `
      <option value="">
        اختر الطالب
      </option>

      ${
        students.map(student => `
          <option value="${student.id}">
            ${escapeHTML(student.name)}
          </option>
        `).join("")
      }
    `;

  } catch (error) {

    showToast(error.message, "error");
  }
}

async function loadNotes() {

  try {

    const students =
      await api("/api/students");

    let rows = "";

    for (const student of students) {

      const notes =
        await api(`/api/notes/${student.id}`);

      notes.forEach(note => {

        rows += `

          <tr>

            <td>
              ${escapeHTML(student.name)}
            </td>

            <td>
              ${escapeHTML(note.text)}
            </td>

            <td>
              ${formatDate(note.created_at)}
            </td>

            <td>

              <button
                class="btn btn-danger btn-small"
                onclick="deleteNote(${note.id})">
                حذف
              </button>

            </td>

          </tr>

        `;
      });
    }

    $("notesTableBody").innerHTML =
      rows || `
        <tr>
          <td colspan="4">
            لا توجد ملاحظات
          </td>
        </tr>
      `;

  } catch (error) {

    showToast(error.message, "error");
  }
}

$("saveNoteButton").addEventListener(
  "click",
  async () => {

    const student_id =
      $("noteStudent").value;

    const text =
      $("noteText").value.trim();

    if (!student_id || !text) {

      showToast(
        "اختر الطالب واكتب الملاحظة",
        "error"
      );

      return;
    }

    try {

      await api("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          student_id,
          text
        })
      });

      $("noteText").value = "";

      showToast("تم حفظ الملاحظة");

      loadNotes();

    } catch (error) {

      showToast(error.message, "error");
    }
  }
);

async function deleteNote(id) {

  if (!confirm("حذف هذه الملاحظة؟")) return;

  try {

    await api(`/api/notes/${id}`, {
      method: "DELETE"
    });

    showToast("تم حذف الملاحظة");

    loadNotes();

  } catch (error) {

    showToast(error.message, "error");
  }
}

// =====================================================
// الفيديوهات
// =====================================================

async function loadVideos() {

  try {

    const videos =
      await api("/api/videos");

    if (!videos.length) {

      $("videosGrid").innerHTML = `
        <div class="card">
          لا توجد حصص مضافة حتى الآن
        </div>
      `;

      return;
    }

    $("videosGrid").innerHTML =
      videos.map(video => `

        <div class="video-card">

          <div class="video-icon">
            🎥
          </div>

          <h3>
            ${escapeHTML(video.title)}
          </h3>

          ${
            video.file_name
              ? `
                <a
                  href="${escapeHTML(video.file_name)}"
                  target="_blank"
                  class="btn btn-primary">
                  ▶ مشاهدة
                </a>
              `
              : `
                <span>
                  لا يوجد فيديو
                </span>
              `
          }

        </div>

      `).join("");

  } catch (error) {

    showToast(error.message, "error");
  }
}

$("addVideoButton").addEventListener("click", () => {

  openModal(
    "إضافة حصة",
    `
      <form id="videoForm">

        <div class="form-group">

          <label>
            اسم الحصة
          </label>

          <input
            id="videoTitle"
            required
          >

        </div>

        <div class="form-group">

          <label>
            رابط الفيديو
          </label>

          <input
            id="videoFile"
            placeholder="https://..."
          >

        </div>

        <button class="btn btn-primary">
          حفظ الحصة
        </button>

      </form>
    `
  );

  $("videoForm").addEventListener(
    "submit",
    async e => {

      e.preventDefault();

      try {

        await api("/api/videos", {
          method: "POST",
          body: JSON.stringify({

            title:
              $("videoTitle").value.trim(),

            file_name:
              $("videoFile").value.trim()
          })
        });

        closeModal();

        showToast("تم إضافة الحصة");

        loadVideos();

      } catch (error) {

        showToast(error.message, "error");
      }
    }
  );
});

// =====================================================
// السجلات
// =====================================================

async function loadLogs() {

  try {

    const logs =
      await api("/api/audit-logs");

    $("logsTableBody").innerHTML =
      logs.map((log, index) => `

        <tr>

          <td>${index + 1}</td>

          <td>
            ${escapeHTML(log.user_name || "النظام")}
          </td>

          <td>
            ${escapeHTML(log.action)}
          </td>

          <td>
            ${escapeHTML(log.details || "-")}
          </td>

          <td>
            ${formatDate(log.created_at)}
          </td>

        </tr>

      `).join("");

  } catch (error) {

    showToast(error.message, "error");
  }
}

$("refreshLogs").addEventListener(
  "click",
  loadLogs
);

// =====================================================
// Modal
// =====================================================

function openModal(title, content) {

  $("modalTitle").textContent = title;

  $("modalBody").innerHTML = content;

  $("modal").classList.remove("hidden");
}

function closeModal() {

  $("modal").classList.add("hidden");

  $("modalBody").innerHTML = "";
}

$("modalClose").addEventListener(
  "click",
  closeModal
);

document.querySelector(".modal-overlay")
  .addEventListener(
    "click",
    closeModal
  );

// =====================================================
// تشغيل النظام
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

  const saved =
    localStorage.getItem("schoolUser");

  if (saved) {

    try {

      currentUser =
        JSON.parse(saved);

      $("loginPage")
        .classList.add("hidden");

      $("appPage")
        .classList.remove("hidden");

      $("currentUserName").textContent =
        `${currentUser.name} (${roleName(currentUser.role)})`;

      applyPermissions();

      startActivity();

      loadDashboard();

    } catch {

      localStorage.removeItem("schoolUser");
    }
  }

});
