// =====================================================
// School Management System - app.js
// =====================================================

let currentUser = null;
let studentsCache = [];
let employeesCache = [];
let usersCache = [];

// =====================================================
// Helpers
// =====================================================

const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "حدث خطأ في الطلب");
    }

    return data;

  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

function showToast(message, type = "success") {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type}`;

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    toast.className = "toast";
    toast.textContent = "";
  }, 3000);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(date) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString("ar-EG");
  } catch {
    return date;
  }
}

function roleName(role) {
  const roles = {
    admin: "مدير",
    teacher: "معلم",
    parent: "ولي أمر",
    student: "طالب"
  };

  return roles[role] || role;
}

// =====================================================
// Login
// =====================================================

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;

  const message = $("loginMessage");

  if (!username || !password) {
    message.textContent = "أدخل اسم المستخدم وكلمة المرور";
    return;
  }

  message.textContent = "جاري تسجيل الدخول...";

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
      "school_current_user",
      JSON.stringify(user)
    );

    showApp();

    showToast(`مرحباً ${user.name}`);

    await initializeApp();

  } catch (error) {
    message.textContent = error.message;
    showToast(error.message, "error");
  }
});

// =====================================================
// Show App
// =====================================================

function showApp() {
  $("loginPage")?.classList.add("hidden");
  $("appPage")?.classList.remove("hidden");

  if ($("currentUserName")) {
    $("currentUserName").textContent =
      `${currentUser.name} — ${roleName(currentUser.role)}`;
  }

  applyPermissions();
}

// =====================================================
// Permissions
// =====================================================

function applyPermissions() {
  if (!currentUser) return;

  const isAdmin = currentUser.role === "admin";

  const usersButton =
    document.querySelector('[data-page="users"]');

  const employeesButton =
    document.querySelector('[data-page="employees"]');

  const payrollButton =
    document.querySelector('[data-page="payroll"]');

  const logsButton =
    document.querySelector('[data-page="logs"]');

  if (!isAdmin) {
    usersButton?.classList.add("hidden");
    employeesButton?.classList.add("hidden");
    payrollButton?.classList.add("hidden");
    logsButton?.classList.add("hidden");
  }
}

// =====================================================
// Logout
// =====================================================

$("logoutButton")?.addEventListener("click", () => {
  currentUser = null;

  localStorage.removeItem("school_current_user");

  $("appPage")?.classList.add("hidden");
  $("loginPage")?.classList.remove("hidden");

  $("username").value = "";
  $("password").value = "";

  showToast("تم تسجيل الخروج");
});

// =====================================================
// Navigation
// =====================================================

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    const page = button.dataset.page;

    if (!page) return;

    document.querySelectorAll(".nav-item")
      .forEach(item => item.classList.remove("active"));

    button.classList.add("active");

    document.querySelectorAll(".page-section")
      .forEach(section => section.classList.add("hidden"));

    const target =
      document.getElementById(`page-${page}`);

    target?.classList.remove("hidden");

    loadPage(page);

  });

});

// =====================================================
// Mobile Menu
// =====================================================

$("menuButton")?.addEventListener("click", () => {
  $("sidebar")?.classList.toggle("open");
});

// =====================================================
// Load Page
// =====================================================

async function loadPage(page) {

  try {

    switch (page) {

      case "dashboard":
        await loadDashboard();
        break;

      case "users":
        await loadUsers();
        break;

      case "students":
        await loadStudents();
        break;

      case "employees":
        await loadEmployees();
        break;

      case "attendance":
        await loadAttendance();
        break;

      case "payroll":
        await loadPayroll();
        break;

      case "notes":
        await loadNotes();
        break;

      case "videos":
        await loadVideos();
        break;

      case "logs":
        await loadLogs();
        break;

    }

  } catch (error) {
    console.error(error);
    showToast(error.message, "error");
  }
}

// =====================================================
// Initialize
// =====================================================

async function initializeApp() {

  await loadDashboard();

  await loadStudents();

  await loadEmployees();

  await loadUsers();

  await loadNotes();

  await loadVideos();

  await loadLogs();

  startActivityHeartbeat();
}

// =====================================================
// Dashboard
// =====================================================

async function loadDashboard() {

  try {

    const users = await api("/api/users");
    const students = await api("/api/students");
    const employees = await api("/api/employees");
    const health = await api("/api/health");

    usersCache = users.users || [];
    studentsCache = students || [];
    employeesCache = employees || [];

    $("statUsers").textContent =
      users.total || 0;

    $("statOnline").textContent =
      users.online_count || 0;

    $("statStudents").textContent =
      students.length || 0;

    $("statEmployees").textContent =
      employees.length || 0;

    if ($("healthStatus")) {
      $("healthStatus").innerHTML = `
        <div class="status-success">
          🟢 النظام يعمل بشكل طبيعي
          <br>
          <small>${formatDate(health.time)}</small>
        </div>
      `;
    }

    const onlineUsers =
      (users.users || []).filter(user => user.online);

    if (!onlineUsers.length) {

      $("onlineUsersList").innerHTML =
        "لا يوجد مستخدمون متصلون الآن";

    } else {

      $("onlineUsersList").innerHTML =
        onlineUsers.map(user => `
          <div class="online-user">
            <span>🟢</span>
            <strong>${escapeHTML(user.name)}</strong>
            <small>${escapeHTML(user.username)}</small>
          </div>
        `).join("");

    }

  } catch (error) {

    if ($("healthStatus")) {
      $("healthStatus").innerHTML =
        `<span class="status-error">🔴 ${escapeHTML(error.message)}</span>`;
    }

    throw error;
  }
}

$("refreshDashboard")?.addEventListener(
  "click",
  loadDashboard
);

// =====================================================
// Activity Heartbeat
// =====================================================

function startActivityHeartbeat() {

  if (!currentUser) return;

  if (window.activityInterval) {
    clearInterval(window.activityInterval);
  }

  window.activityInterval = setInterval(async () => {

    if (!currentUser) return;

    try {

      const result = await api("/api/activity", {
        method: "POST",
        body: JSON.stringify({
          user_id: currentUser.id
        })
      });

      currentUser.last_seen = result.last_seen;

      localStorage.setItem(
        "school_current_user",
        JSON.stringify(currentUser)
      );

    } catch (error) {

      console.error(
        "Activity error:",
        error
      );

    }

  }, 30000);
}

// =====================================================
// Users
// =====================================================

async function loadUsers() {

  if (currentUser?.role !== "admin") return;

  const data = await api("/api/users");

  usersCache = data.users || [];

  $("usersTotal").textContent =
    data.total || 0;

  $("usersActive").textContent =
    data.active_count || 0;

  $("usersOnline").textContent =
    data.online_count || 0;

  const body =
    $("usersTableBody");

  if (!body) return;

  if (!usersCache.length) {

    body.innerHTML = `
      <tr>
        <td colspan="7">
          لا يوجد مستخدمون
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = usersCache.map(user => {

    const status = user.active
      ? `<span class="badge success">نشط</span>`
      : `<span class="badge danger">موقوف</span>`;

    const online = user.online
      ? `<span class="online-text">🟢 متصل</span>`
      : `<span>⚪ غير متصل</span>`;

    let action = "";

    if (user.username === "admin") {

      action = `
        <button
          class="btn btn-secondary btn-small"
          onclick="changeUserPassword(${user.id})"
        >
          🔑 كلمة المرور
        </button>
      `;

    } else {

      action = `
        ${
          user.active
            ? `
              <button
                class="btn btn-warning btn-small"
                onclick="disableUser(${user.id})"
              >
                إيقاف
              </button>
            `
            : `
              <button
                class="btn btn-success btn-small"
                onclick="enableUser(${user.id})"
              >
                تفعيل
              </button>
            `
        }

        <button
          class="btn btn-secondary btn-small"
          onclick="changeUserPassword(${user.id})"
        >
          🔑
        </button>

        <button
          class="btn btn-danger btn-small"
          onclick="deleteUser(${user.id})"
        >
          حذف
        </button>
      `;

    }

    return `
      <tr>

        <td>${user.id}</td>

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
          <br>
          ${online}
        </td>

        <td>
          ${formatDate(user.last_seen)}
        </td>

        <td>
          <div class="action-buttons">
            ${action}
          </div>
        </td>

      </tr>
    `;

  }).join("");
}

// =====================================================
// Add User
// =====================================================

$("addUserButton")?.addEventListener(
  "click",
  showAddUserModal
);

function showAddUserModal() {

  openModal(
    "إضافة مستخدم",
    `
      <form id="addUserForm">

        <div class="form-group">
          <label>اسم المستخدم</label>
          <input id="newUsername" required>
        </div>

        <div class="form-group">
          <label>كلمة المرور</label>
          <input id="newPassword" type="password" required>
        </div>

        <div class="form-group">
          <label>الاسم</label>
          <input id="newName" required>
        </div>

        <div class="form-group">
          <label>الصلاحية</label>

          <select id="newRole">

            <option value="teacher">
              معلم
            </option>

            <option value="parent">
              ولي أمر
            </option>

            <option value="student">
              طالب
            </option>

            <option value="admin">
              مدير
            </option>

          </select>

        </div>

        <button
          class="btn btn-primary"
          type="submit"
        >
          إضافة المستخدم
        </button>

      </form>
    `
  );

  $("addUserForm").addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      try {

        await api("/api/users", {
          method: "POST",
          body: JSON.stringify({
            username: $("newUsername").value.trim(),
            password: $("newPassword").value,
            name: $("newName").value.trim(),
            role: $("newRole").value
          })
        });

        closeModal();

        showToast("تم إضافة المستخدم");

        await loadUsers();

      } catch (error) {

        showToast(error.message, "error");

      }

    }
  );
}

// =====================================================
// User Actions
// =====================================================

async function disableUser(id) {

  if (!confirm("هل تريد إيقاف هذا المستخدم؟")) {
    return;
  }

  try {

    await api(`/api/users/${id}/disable`, {
      method: "PATCH"
    });

    showToast("تم إيقاف المستخدم");

    await loadUsers();

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

    await loadUsers();

  } catch (error) {

    showToast(error.message, "error");

  }
}

async function deleteUser(id) {

  if (!confirm("هل أنت متأكد من حذف المستخدم؟")) {
    return;
  }

  try {

    await api(`/api/users/${id}`, {
      method: "DELETE"
    });

    showToast("تم حذف المستخدم");

    await loadUsers();

  } catch (error) {

    showToast(error.message, "error");

  }
}

async function changeUserPassword(id) {

  openModal(
    "تغيير كلمة المرور",
    `
      <form id="changePasswordForm">

        <div class="form-group">

          <label>
            كلمة المرور الجديدة
          </label>

          <input
            id="newUserPassword"
            type="password"
            minlength="4"
            required
          >

        </div>

        <button
          class="btn btn-primary"
          type="submit"
        >
          تغيير كلمة المرور
        </button>

      </form>
    `
  );

  $("changePasswordForm").addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      try {

        await api(`/api/users/${id}/password`, {
          method: "PATCH",
          body: JSON.stringify({
            new_password:
              $("newUserPassword").value
          })
        });

        closeModal();

        showToast(
          "تم تغيير كلمة المرور"
        );

      } catch (error) {

        showToast(error.message, "error");

      }

    }
  );
}

// =====================================================
// Students
// =====================================================

async function loadStudents() {

  const students =
    await api("/api/students");

  studentsCache = students || [];

  const body =
    $("studentsTableBody");

  if (!body) return;

  if (!students.length) {

    body.innerHTML = `
      <tr>
        <td colspan="6">
          لا يوجد طلاب
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    students.map(student => {

      const status =
        student.status === "حاضر"
          ? `<span class="badge success">حاضر</span>`
          : `<span class="badge danger">غائب</span>`;

      return `
        <tr>

          <td>${student.id}</td>

          <td>
            <strong>
              ${escapeHTML(student.name)}
            </strong>
          </td>

          <td>
            ${escapeHTML(student.class_name)}
          </td>

          <td>
            ${escapeHTML(student.parent_phone)}
          </td>

          <td>
            ${status}
          </td>

          <td>

            <button
              class="btn btn-secondary btn-small"
              onclick="toggleStudentAttendance(${student.id})"
            >
              تغيير الحالة
            </button>

          </td>

        </tr>
      `;

    }).join("");

  fillStudentSelect();
}

$("addStudentButton")?.addEventListener(
  "click",
  showAddStudentModal
);

function showAddStudentModal() {

  openModal(
    "إضافة طالب",
    `
      <form id="addStudentForm">

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
          <input id="studentPhone">
        </div>

        <button
          class="btn btn-primary"
          type="submit"
        >
          إضافة الطالب
        </button>

      </form>
    `
  );

  $("addStudentForm").addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      try {

        await api("/api/students", {
          method: "POST",
          body: JSON.stringify({
            name:
              $("studentName").value.trim(),

            class_name:
              $("studentClass").value.trim(),

            parent_phone:
              $("studentPhone").value.trim()
          })
        });

        closeModal();

        showToast("تم إضافة الطالب");

        await loadStudents();

        await loadDashboard();

      } catch (error) {

        showToast(error.message, "error");

      }

    }
  );
}

async function toggleStudentAttendance(id) {

  try {

    const result =
      await api(`/api/students/${id}/status`, {
        method: "PATCH"
      });

    showToast(
      `تم تغيير الحالة إلى ${result.status}`
    );

    await loadStudents();

    await loadAttendance();

  } catch (error) {

    showToast(error.message, "error");

  }
}

// =====================================================
// Employees
// =====================================================

async function loadEmployees() {

  const employees =
    await api("/api/employees");

  employeesCache = employees || [];

  const body =
    $("employeesTableBody");

  if (!body) return;

  if (!employees.length) {

    body.innerHTML = `
      <tr>
        <td colspan="9">
          لا يوجد موظفون
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    employees.map(employee => {

      const salary =
        Number(employee.basic_salary || 0) +
        Number(employee.allowance || 0);

      const status =
        employee.active
          ? `<span class="badge success">نشط</span>`
          : `<span class="badge danger">موقوف</span>`;

      return `
        <tr>

          <td>${employee.id}</td>

          <td>
            ${escapeHTML(employee.employee_number || "-")}
          </td>

          <td>
            <strong>
              ${escapeHTML(employee.name)}
            </strong>
          </td>

          <td>
            ${escapeHTML(employee.job_title || "-")}
          </td>

          <td>
            ${escapeHTML(employee.department || "-")}
          </td>

          <td>
            ${escapeHTML(employee.phone || "-")}
          </td>

          <td>
            ${salary.toLocaleString()} 
          </td>

          <td>
            ${status}
          </td>

          <td>

            <button
              class="btn btn-secondary btn-small"
              onclick="employeeDetails(${employee.id})"
            >
              التفاصيل
            </button>

          </td>

        </tr>
      `;

    }).join("");
}

$("addEmployeeButton")?.addEventListener(
  "click",
  showAddEmployeeModal
);

function showAddEmployeeModal() {

  openModal(
    "إضافة موظف",
    `
      <form id="addEmployeeForm">

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
          <input id="employeeHireDate" type="date">
        </div>

        <div class="form-group">
          <label>الراتب الأساسي</label>
          <input id="employeeSalary" type="number" min="0">
        </div>

        <div class="form-group">
          <label>البدل</label>
          <input id="employeeAllowance" type="number" min="0">
        </div>

        <button
          class="btn btn-primary"
          type="submit"
        >
          إضافة الموظف
        </button>

      </form>
    `
  );

  $("addEmployeeForm").addEventListener(
    "submit",
    async event => {

      event.preventDefault();

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
              $("employeeHireDate").value,

            basic_salary:
              Number($("employeeSalary").value || 0),

            allowance:
              Number($("employeeAllowance").value || 0)

          })
        });

        closeModal();

        showToast("تم إضافة الموظف");

        await loadEmployees();

        await loadDashboard();

      } catch (error) {

        showToast(error.message, "error");

      }

    }
  );
}

async function employeeDetails(id) {

  const employee =
    employeesCache.find(
      x => Number(x.id) === Number(id)
    );

  if (!employee) return;

  let payroll = null;

  try {
    payroll =
      await api(`/api/employees/${id}/payroll`);
  } catch {}

  openModal(
    "بيانات الموظف",
    `
      <div class="details-box">

        <p>
          <strong>الاسم:</strong>
          ${escapeHTML(employee.name)}
        </p>

        <p>
          <strong>رقم الموظف:</strong>
          ${escapeHTML(employee.employee_number || "-")}
        </p>

        <p>
          <strong>الوظيفة:</strong>
          ${escapeHTML(employee.job_title || "-")}
        </p>

        <p>
          <strong>القسم:</strong>
          ${escapeHTML(employee.department || "-")}
        </p>

        <p>
          <strong>الهاتف:</strong>
          ${escapeHTML(employee.phone || "-")}
        </p>

        ${
          payroll
            ? `
              <hr>

              <p>
                <strong>الأساسي:</strong>
                ${payroll.basic_salary.toLocaleString()}
              </p>

              <p>
                <strong>البدلات:</strong>
                ${payroll.allowance.toLocaleString()}
              </p>

              <p>
                <strong>المكافآت:</strong>
                ${payroll.bonuses.toLocaleString()}
              </p>

              <p>
                <strong>الخصومات:</strong>
                ${payroll.deductions.toLocaleString()}
              </p>

              <p>
                <strong>الصافي:</strong>
                ${payroll.net.toLocaleString()}
              </p>
            `
            : ""
        }

      </div>
    `
  );
}

// =====================================================
// Attendance
// =====================================================

document.querySelectorAll(".attendance-tab")
  .forEach(button => {

    button.addEventListener("click", async () => {

      document.querySelectorAll(".attendance-tab")
        .forEach(item =>
          item.classList.remove("active")
        );

      button.classList.add("active");

      const type =
        button.dataset.attendanceType;

      if (type === "students") {

        $("studentAttendancePanel")
          ?.classList.remove("hidden");

        $("employeeAttendancePanel")
          ?.classList.add("hidden");

        await loadStudentAttendance();

      } else {

        $("studentAttendancePanel")
          ?.classList.add("hidden");

        $("employeeAttendancePanel")
          ?.classList.remove("hidden");

        await loadEmployeeAttendance();

      }

    });

  });

async function loadAttendance() {

  await loadStudentAttendance();

}

async function loadStudentAttendance() {

  const students =
    await api("/api/students");

  const body =
    $("attendanceStudentsBody");

  if (!body) return;

  body.innerHTML =
    students.map(student => {

      const status =
        student.status === "حاضر"
          ? `<span class="badge success">حاضر</span>`
          : `<span class="badge danger">غائب</span>`;

      return `
        <tr>

          <td>
            ${escapeHTML(student.name)}
          </td>

          <td>
            ${escapeHTML(student.class_name)}
          </td>

          <td>
            ${status}
          </td>

          <td>

            <button
              class="btn btn-secondary btn-small"
              onclick="toggleStudentAttendance(${student.id})"
            >
              تغيير
            </button>

          </td>

        </tr>
      `;

    }).join("");
}

async function loadEmployeeAttendance() {

  const employees =
    await api("/api/employees");

  const body =
    $("attendanceEmployeesBody");

  if (!body) return;

  body.innerHTML = "";

  for (const employee of employees) {

    try {

      const data =
        await api(
          `/api/employees/${employee.id}/attendance`
        );

      const latest =
        data.records?.[0];

      if (!latest) {

        body.innerHTML += `
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

      body.innerHTML += `
        <tr>

          <td>
            ${escapeHTML(employee.name)}
          </td>

          <td>
            ${latest.date}
          </td>

          <td>
            ${latest.check_in || "-"}
          </td>

          <td>
            ${latest.check_out || "-"}
          </td>

          <td>
            ${escapeHTML(latest.status)}
          </td>

          <td>
            ${latest.late_minutes || 0} دقيقة
          </td>

        </tr>
      `;

    } catch (error) {

      console.error(error);

    }

  }
}

$("refreshStudentAttendance")?.addEventListener(
  "click",
  loadStudentAttendance
);

// =====================================================
// Payroll
// =====================================================

async function loadPayroll() {

  const employees =
    await api("/api/employees");

  const body =
    $("payrollTableBody");

  if (!body) return;

  body.innerHTML = "";

  for (const employee of employees) {

    try {

      const payroll =
        await api(
          `/api/employees/${employee.id}/payroll`
        );

      body.innerHTML += `
        <tr>

          <td>
            ${escapeHTML(employee.name)}
          </td>

          <td>
            ${payroll.basic_salary.toLocaleString()}
          </td>

          <td>
            ${payroll.allowance.toLocaleString()}
          </td>

          <td>
            ${payroll.bonuses.toLocaleString()}
          </td>

          <td>
            ${payroll.deductions.toLocaleString()}
          </td>

          <td>
            <strong>
              ${payroll.net.toLocaleString()}
            </strong>
          </td>

          <td>

            <button
              class="btn btn-secondary btn-small"
              onclick="employeePayroll(${employee.id})"
            >
              كشف الراتب
            </button>

          </td>

        </tr>
      `;

    } catch (error) {

      console.error(error);

    }

  }
}

async function employeePayroll(id) {

  try {

    const payroll =
      await api(
        `/api/employees/${id}/payroll`
      );

    openModal(
      "كشف الراتب",
      `
        <div class="payroll-details">

          <h3>
            ${escapeHTML(payroll.employee.name)}
          </h3>

          <p>
            الشهر:
            ${payroll.month}
          </p>

          <hr>

          <p>
            الأساسي:
            <strong>
              ${payroll.basic_salary.toLocaleString()}
            </strong>
          </p>

          <p>
            البدلات:
            <strong>
              ${payroll.allowance.toLocaleString()}
            </strong>
          </p>

          <p>
            المكافآت:
            <strong>
              ${payroll.bonuses.toLocaleString()}
            </strong>
          </p>

          <p>
            الخصومات:
            <strong>
              ${payroll.deductions.toLocaleString()}
            </strong>
          </p>

          <hr>

          <h2>
            الصافي:
            ${payroll.net.toLocaleString()}
          </h2>

        </div>
      `
    );

  } catch (error) {

    showToast(error.message, "error");

  }
}

$("payrollSettingsButton")?.addEventListener(
  "click",
  showPayrollSettings
);

async function showPayrollSettings() {

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

          <button
            class="btn btn-primary"
            type="submit"
          >
            حفظ الإعدادات
          </button>

        </form>
      `
    );

    $("payrollSettingsForm").addEventListener(
      "submit",
      async event => {

        event.preventDefault();

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

          showToast(
            "تم تحديث إعدادات الرواتب"
          );

        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      }
    );

  } catch (error) {

    showToast(error.message, "error");

  }
}

// =====================================================
// Notes
// =====================================================

function fillStudentSelect() {

  const select =
    $("noteStudent");

  if (!select) return;

  select.innerHTML = `
    <option value="">
      اختر الطالب
    </option>
  `;

  studentsCache.forEach(student => {

    select.innerHTML += `
      <option value="${student.id}">
        ${escapeHTML(student.name)}
      </option>
    `;

  });
}

$("saveNoteButton")?.addEventListener(
  "click",
  saveNote
);

async function saveNote() {

  const studentId =
    $("noteStudent").value;

  const text =
    $("noteText").value.trim();

  if (!studentId || !text) {

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
        student_id: Number(studentId),
        text
      })
    });

    $("noteText").value = "";

    showToast("تم حفظ الملاحظة");

    await loadNotes();

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }
}

async function loadNotes() {

  const body =
    $("notesTableBody");

  if (!body) return;

  body.innerHTML = "";

  for (const student of studentsCache) {

    try {

      const notes =
        await api(
          `/api/notes/${student.id}`
        );

      notes.forEach(note => {

        body.innerHTML += `
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
                onclick="deleteNote(${note.id})"
              >
                حذف
              </button>

            </td>

          </tr>
        `;

      });

    } catch (error) {

      console.error(error);

    }

  }
}

async function deleteNote(id) {

  if (!confirm("هل تريد حذف الملاحظة؟")) {
    return;
  }

  try {

    await api(`/api/notes/${id}`, {
      method: "DELETE"
    });

    showToast("تم حذف الملاحظة");

    await loadNotes();

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }
}

// =====================================================
// Videos
// =====================================================

$("addVideoButton")?.addEventListener(
  "click",
  showAddVideoModal
);

function showAddVideoModal() {

  openModal(
    "إضافة حصة",
    `
      <form id="addVideoForm">

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
            رابط أو اسم الفيديو
          </label>

          <input
            id="videoFile"
            placeholder="ضع الرابط هنا"
          >

        </div>

        <button
          class="btn btn-primary"
          type="submit"
        >
          حفظ الحصة
        </button>

      </form>
    `
  );

  $("addVideoForm").addEventListener(
    "submit",
    async event => {

      event.preventDefault();

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

        await loadVideos();

      } catch (error) {

        showToast(
          error.message,
          "error"
        );

      }

    }
  );
}

async function loadVideos() {

  const videos =
    await api("/api/videos");

  const grid =
    $("videosGrid");

  if (!grid) return;

  if (!videos.length) {

    grid.innerHTML =
      `<div class="card">لا توجد حصص حالياً</div>`;

    return;
  }

  grid.innerHTML =
    videos.map(video => {

      const file =
        video.file_name || "";

      return `
        <div class="video-card">

          <div class="video-icon">
            🎥
          </div>

          <h3>
            ${escapeHTML(video.title)}
          </h3>

          ${
            file
              ? `
                <a
                  href="${escapeHTML(file)}"
                  target="_blank"
                  rel="noopener"
                  class="btn btn-primary"
                >
                  مشاهدة الحصة
                </a>
              `
              : `
                <span>
                  لم يتم إضافة رابط
                </span>
              `
          }

        </div>
      `;

    }).join("");
}

// =====================================================
// Logs
// =====================================================

async function loadLogs() {

  if (currentUser?.role !== "admin") return;

  const logs =
    await api("/api/audit-logs");

  const body =
    $("logsTableBody");

  if (!body) return;

  body.innerHTML =
    logs.map(log => {

      return `
        <tr>

          <td>
            ${log.id}
          </td>

          <td>
            ${escapeHTML(
              log.user_name ||
              log.username ||
              "النظام"
            )}
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
      `;

    }).join("");
}

$("refreshLogs")?.addEventListener(
  "click",
  loadLogs
);

// =====================================================
// Modal
// =====================================================

function openModal(title, html) {

  $("modalTitle").textContent = title;

  $("modalBody").innerHTML = html;

  $("modal").classList.remove("hidden");
}

function closeModal() {

  $("modal").classList.add("hidden");

  $("modalBody").innerHTML = "";
}

$("modalClose")?.addEventListener(
  "click",
  closeModal
);

document.querySelector(".modal-overlay")
  ?.addEventListener(
    "click",
    closeModal
  );

// =====================================================
// Auto Login
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      const saved =
        localStorage.getItem(
          "school_current_user"
        );

      if (!saved) {
        return;
      }

      currentUser =
        JSON.parse(saved);

      if (!currentUser?.id) {
        throw new Error("Invalid session");
      }

      const result =
        await api("/api/activity", {
          method: "POST",

          body: JSON.stringify({
            user_id: currentUser.id
          })
        });

      currentUser.last_seen =
        result.last_seen;

      showApp();

      await initializeApp();

    } catch (error) {

      console.log(
        "No active session"
      );

      localStorage.removeItem(
        "school_current_user"
      );

    }

  }
);

// =====================================================
// Global Functions
// =====================================================

window.disableUser = disableUser;
window.enableUser = enableUser;
window.deleteUser = deleteUser;
window.changeUserPassword = changeUserPassword;

window.toggleStudentAttendance =
  toggleStudentAttendance;

window.employeeDetails =
  employeeDetails;

window.employeePayroll =
  employeePayroll;

window.deleteNote =
  deleteNote;

window.openModal =
  openModal;

window.closeModal =
  closeModal;
