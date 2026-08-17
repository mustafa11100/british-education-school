// =====================================================
// app.js
// نظام إدارة المدرسة
// =====================================================

"use strict";

// =====================================================
// المتغيرات العامة
// =====================================================

let currentUser = null;
let currentPage = "dashboard";
let studentsCache = [];
let employeesCache = [];
let usersCache = [];
let notesCache = [];
let videosCache = [];

// =====================================================
// Helpers
// =====================================================

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString("ar-EG", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  } catch {
    return date;
  }
}

function showToast(message, type = "success") {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;

  toast.className = "toast";

  if (type === "error") {
    toast.classList.add("toast-error");
  }

  if (type === "warning") {
    toast.classList.add("toast-warning");
  }

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let data;

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        "حدث خطأ في الاتصال بالسيرفر"
      );
    }

    return data;

  } catch (error) {
    console.error(error);
    throw error;
  }
}

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

$("modalClose")?.addEventListener("click", closeModal);

document.querySelector(".modal-overlay")
  ?.addEventListener("click", closeModal);

// =====================================================
// Login
// =====================================================

$("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

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
      "school_current_user",
      JSON.stringify(user)
    );

    showApp();

    showToast(`مرحباً ${user.name}`);

  } catch (error) {
    message.textContent = error.message;
    message.className = "message error";
  }
});

// =====================================================
// Show App
// =====================================================

function showApp() {
  $("loginPage").classList.add("hidden");
  $("appPage").classList.remove("hidden");

  updateCurrentUser();

  loadDashboard();
}

// =====================================================
// Current User
// =====================================================

function updateCurrentUser() {
  if (!currentUser) return;

  $("currentUserName").textContent =
    currentUser.name || currentUser.username;

  updateUserPermissions();
}

function updateUserPermissions() {
  if (!currentUser) return;

  const role = currentUser.role;

  // المدير يرى كل شيء
  if (role === "admin") return;

  // المستخدم العادي لا يرى سجل العمليات
  const logsButton =
    document.querySelector('[data-page="logs"]');

  if (logsButton) {
    logsButton.style.display = "none";
  }

  // الرواتب للمدير فقط
  const payrollButton =
    document.querySelector('[data-page="payroll"]');

  if (
    payrollButton &&
    role !== "admin"
  ) {
    payrollButton.style.display = "none";
  }
}

// =====================================================
// Logout
// =====================================================

$("logoutButton")?.addEventListener("click", () => {
  if (!confirm("هل تريد تسجيل الخروج؟")) return;

  currentUser = null;

  localStorage.removeItem("school_current_user");

  $("appPage").classList.add("hidden");
  $("loginPage").classList.remove("hidden");

  $("username").value = "";
  $("password").value = "";

  showToast("تم تسجيل الخروج");
});

// =====================================================
// Navigation
// =====================================================

document.querySelectorAll(".nav-item")
  .forEach(button => {

    button.addEventListener("click", () => {

      const page = button.dataset.page;

      navigateTo(page);

    });

  });

function navigateTo(page) {

  currentPage = page;

  document.querySelectorAll(".nav-item")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page === page
      );

    });

  document.querySelectorAll(".page-section")
    .forEach(section => {

      section.classList.add("hidden");

    });

  const target = $(`page-${page}`);

  if (target) {
    target.classList.remove("hidden");
  }

  loadPage(page);
}

// =====================================================
// Menu
// =====================================================

$("menuButton")?.addEventListener("click", () => {

  $("sidebar").classList.toggle("open");

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

    showToast(
      error.message || "حدث خطأ",
      "error"
    );

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

    usersCache = users.users || [];
    studentsCache = students || [];
    employeesCache = employees || [];

    $("statUsers").textContent =
      users.total || 0;

    $("statOnline").textContent =
      users.online_count || 0;

    $("statStudents").textContent =
      studentsCache.length;

    $("statEmployees").textContent =
      employeesCache.length;

    $("healthStatus").innerHTML = `
      <div class="status-success">
        🟢 ${escapeHTML(health.message)}
      </div>

      <div class="small-text">
        ${formatDate(health.time)}
      </div>
    `;

    const onlineUsers =
      usersCache.filter(user => user.online);

    if (!onlineUsers.length) {

      $("onlineUsersList").innerHTML =
        "لا يوجد مستخدمون متصلون الآن";

    } else {

      $("onlineUsersList").innerHTML =
        onlineUsers.map(user => `
          <div class="online-user">
            🟢
            <strong>
              ${escapeHTML(user.name)}
            </strong>
            <span>
              ${roleName(user.role)}
            </span>
          </div>
        `).join("");

    }

  } catch (error) {

    $("healthStatus").innerHTML =
      `<span class="error">
        ${escapeHTML(error.message)}
      </span>`;

  }

}

// =====================================================
// Refresh Dashboard
// =====================================================

$("refreshDashboard")
  ?.addEventListener("click", async () => {

    await loadDashboard();

    showToast("تم تحديث لوحة التحكم");

  });

// =====================================================
// User Roles
// =====================================================

function roleName(role) {

  const roles = {

    admin: "مدير المؤسسة",
    teacher: "أستاذ",
    parent: "ولي أمر",
    student: "طالب",
    hr: "الموارد البشرية",
    accountant: "محاسب",
    worker: "عامل",
    reviewer: "مراجع",
    employee: "موظف"

  };

  return roles[role] || role || "مستخدم";
}

// =====================================================
// Users
// =====================================================

async function loadUsers() {

  const data = await api("/api/users");

  usersCache = data.users || [];

  $("usersTotal").textContent =
    data.total || 0;

  $("usersActive").textContent =
    data.active_count || 0;

  $("usersOnline").textContent =
    data.online_count || 0;

  const tbody = $("usersTableBody");

  if (!usersCache.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          لا يوجد مستخدمون
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    usersCache.map((user, index) => {

      const status =
        user.active
          ? `<span class="badge success">نشط</span>`
          : `<span class="badge danger">موقوف</span>`;

      const online =
        user.online
          ? `<span class="badge success">🟢 متصل</span>`
          : `<span class="badge">غير متصل</span>`;

      return `
        <tr>

          <td>${index + 1}</td>

          <td>
            ${escapeHTML(user.username)}
          </td>

          <td>
            <strong>
              ${escapeHTML(user.name)}
            </strong>
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

            ${
              user.username !== "admin"
                ? `
                  ${
                    user.active
                      ? `
                        <button
                          class="btn btn-danger btn-small"
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
                    كلمة المرور
                  </button>

                  <button
                    class="btn btn-danger btn-small"
                    onclick="deleteUser(${user.id})"
                  >
                    حذف
                  </button>
                `
                : `
                  <span class="badge">
                    المدير الرئيسي
                  </span>
                `
            }

          </td>

        </tr>
      `;

    }).join("");

}

// =====================================================
// Add User
// =====================================================

$("addUserButton")
  ?.addEventListener("click", () => {

    openModal(
      "إضافة مستخدم",
      `
      <form id="addUserForm">

        <div class="form-group">

          <label>اسم المستخدم</label>

          <input
            id="newUsername"
            required
            placeholder="مثال: ahmed"
          >

        </div>

        <div class="form-group">

          <label>الاسم الحقيقي</label>

          <input
            id="newUserName"
            required
            placeholder="مثال: أحمد محمد"
          >

        </div>

        <div class="form-group">

          <label>نوع المستخدم</label>

          <select id="newUserRole">

            <option value="employee">
              موظف
            </option>

            <option value="teacher">
              أستاذ
            </option>

            <option value="hr">
              HR
            </option>

            <option value="accountant">
              محاسب
            </option>

            <option value="worker">
              عامل
            </option>

            <option value="reviewer">
              مراجع
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

        <div class="form-group">

          <label>كلمة المرور</label>

          <input
            id="newUserPassword"
            type="password"
            required
            minlength="4"
          >

        </div>

        <button
          type="submit"
          class="btn btn-primary"
        >
          إضافة المستخدم
        </button>

      </form>
      `
    );

    $("addUserForm")
      ?.addEventListener("submit", async (event) => {

        event.preventDefault();

        try {

          await api("/api/users", {
            method: "POST",

            body: JSON.stringify({

              username:
                $("newUsername").value.trim(),

              name:
                $("newUserName").value.trim(),

              role:
                $("newUserRole").value,

              password:
                $("newUserPassword").value

            })

          });

          closeModal();

          showToast(
            "تم إضافة المستخدم بنجاح"
          );

          await loadUsers();

        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      });

  });

// =====================================================
// Disable User
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

    showToast(
      error.message,
      "error"
    );

  }

}

// =====================================================
// Enable User
// =====================================================

async function enableUser(id) {

  try {

    await api(`/api/users/${id}/enable`, {
      method: "PATCH"
    });

    showToast("تم تفعيل المستخدم");

    await loadUsers();

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}

// =====================================================
// Delete User
// =====================================================

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

    showToast(
      error.message,
      "error"
    );

  }

}

// =====================================================
// Change Password
// =====================================================

function changeUserPassword(id) {

  openModal(
    "تغيير كلمة المرور",
    `
      <form id="changePasswordForm">

        <div class="form-group">

          <label>
            كلمة المرور الجديدة
          </label>

          <input
            id="newPassword"
            type="password"
            minlength="4"
            required
          >

        </div>

        <button
          class="btn btn-primary"
          type="submit"
        >
          حفظ كلمة المرور
        </button>

      </form>
    `
  );

  $("changePasswordForm")
    ?.addEventListener("submit", async event => {

      event.preventDefault();

      try {

        await api(
          `/api/users/${id}/password`,
          {
            method: "PATCH",

            body: JSON.stringify({
              new_password:
                $("newPassword").value
            })
          }
        );

        closeModal();

        showToast(
          "تم تغيير كلمة المرور"
        );

      } catch (error) {

        showToast(
          error.message,
          "error"
        );

      }

    });

}

// =====================================================
// Students
// =====================================================

async function loadStudents() {

  studentsCache =
    await api("/api/students");

  const tbody =
    $("studentsTableBody");

  if (!studentsCache.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          لا يوجد طلاب
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    studentsCache.map((student, index) => {

      return `
        <tr>

          <td>
            ${index + 1}
          </td>

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
            ${
              student.status === "حاضر"
                ? `<span class="badge success">حاضر</span>`
                : `<span class="badge danger">غائب</span>`
            }
          </td>

          <td>

            <button
              class="btn btn-secondary btn-small"
              onclick="toggleStudentStatus(${student.id})"
            >
              تغيير الحالة
            </button>

          </td>

        </tr>
      `;

    }).join("");

  populateStudentSelect();

}

// =====================================================
// Add Student
// =====================================================

$("addStudentButton")
  ?.addEventListener("click", () => {

    openModal(
      "إضافة طالب",
      `
      <form id="addStudentForm">

        <div class="form-group">

          <label>اسم الطالب</label>

          <input
            id="studentName"
            required
          >

        </div>

        <div class="form-group">

          <label>الفصل</label>

          <input
            id="studentClass"
            required
            placeholder="مثال: الصف السادس"
          >

        </div>

        <div class="form-group">

          <label>هاتف ولي الأمر</label>

          <input
            id="parentPhone"
            type="tel"
          >

        </div>

        <button
          class="btn btn-primary"
          type="submit"
        >
          حفظ الطالب
        </button>

      </form>
      `
    );

    $("addStudentForm")
      ?.addEventListener("submit", async event => {

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
                $("parentPhone").value.trim()

            })

          });

          closeModal();

          showToast("تم إضافة الطالب");

          await loadStudents();

        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      });

  });

// =====================================================
// Toggle Student Status
// =====================================================

async function toggleStudentStatus(id) {

  try {

    await api(
      `/api/students/${id}/status`,
      {
        method: "PATCH"
      }
    );

    showToast(
      "تم تحديث حالة الطالب"
    );

    await loadStudents();

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}

// =====================================================
// Employees
// =====================================================

async function loadEmployees() {

  employeesCache =
    await api("/api/employees");

  const tbody =
    $("employeesTableBody");

  if (!employeesCache.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          لا يوجد موظفون
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    employeesCache.map((employee, index) => {

      const salary =
        Number(employee.basic_salary || 0) +
        Number(employee.allowance || 0);

      return `
        <tr>

          <td>
            ${index + 1}
          </td>

          <td>
            ${escapeHTML(
              employee.employee_number || "-"
            )}
          </td>

          <td>
            <strong>
              ${escapeHTML(employee.name)}
            </strong>
          </td>

          <td>
            ${escapeHTML(
              employee.job_title || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              employee.department || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              employee.phone || "-"
            )}
          </td>

          <td>
            ${salary.toLocaleString("ar-EG")}
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
              class="btn btn-secondary btn-small"
              onclick="viewEmployee(${employee.id})"
            >
              عرض
            </button>

          </td>

        </tr>
      `;

    }).join("");

}

// =====================================================
// Add Employee
// =====================================================

$("addEmployeeButton")
  ?.addEventListener("click", () => {

    openModal(
      "إضافة موظف",
      `
      <form id="addEmployeeForm">

        <div class="form-group">

          <label>
            رقم الموظف
          </label>

          <input id="employeeNumber">

        </div>

        <div class="form-group">

          <label>
            الاسم
          </label>

          <input
            id="employeeName"
            required
          >

        </div>

        <div class="form-group">

          <label>
            المسمى الوظيفي
          </label>

          <input
            id="employeeJob"
            placeholder="أستاذ، HR، محاسب، عامل..."
          >

        </div>

        <div class="form-group">

          <label>
            القسم
          </label>

          <input
            id="employeeDepartment"
          >

        </div>

        <div class="form-group">

          <label>
            الهاتف
          </label>

          <input
            id="employeePhone"
          >

        </div>

        <div class="form-group">

          <label>
            تاريخ التعيين
          </label>

          <input
            id="hireDate"
            type="date"
          >

        </div>

        <div class="form-group">

          <label>
            الراتب الأساسي
          </label>

          <input
            id="basicSalary"
            type="number"
            min="0"
            value="0"
          >

        </div>

        <div class="form-group">

          <label>
            البدلات
          </label>

          <input
            id="allowance"
            type="number"
            min="0"
            value="0"
          >

        </div>

        <button
          class="btn btn-primary"
          type="submit"
        >
          حفظ الموظف
        </button>

      </form>
      `
    );

    $("addEmployeeForm")
      ?.addEventListener("submit", async event => {

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
                $("hireDate").value,

              basic_salary:
                Number($("basicSalary").value || 0),

              allowance:
                Number($("allowance").value || 0)

            })

          });

          closeModal();

          showToast(
            "تم إضافة الموظف"
          );

          await loadEmployees();

        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      });

  });

// =====================================================
// View Employee
// =====================================================

async function viewEmployee(id) {

  const employee =
    employeesCache.find(
      item => item.id === id
    );

  if (!employee) return;

  openModal(
    "بيانات الموظف",
    `
      <div class="employee-details">

        <h3>
          ${escapeHTML(employee.name)}
        </h3>

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

        <p>
          <strong>رقم الموظف:</strong>
          ${escapeHTML(employee.employee_number || "-")}
        </p>

        <hr>

        <button
          class="btn btn-primary"
          onclick="showEmployeePayroll(${id})"
        >
          💰 كشف الراتب
        </button>

        <button
          class="btn btn-secondary"
          onclick="showEmployeeAttendance(${id})"
        >
          📋 سجل الحضور
        </button>

      </div>
    `
  );

}

// =====================================================
// Attendance
// =====================================================

async function loadAttendance() {

  await loadStudentAttendance();

  await loadEmployeeAttendance();

}

async function loadStudentAttendance() {

  studentsCache =
    await api("/api/students");

  const tbody =
    $("attendanceStudentsBody");

  if (!studentsCache.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          لا يوجد طلاب
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    studentsCache.map(student => {

      return `
        <tr>

          <td>
            ${escapeHTML(student.name)}
          </td>

          <td>
            ${escapeHTML(student.class_name)}
          </td>

          <td>
            ${
              student.status === "حاضر"
                ? "🟢 حاضر"
                : "🔴 غائب"
            }
          </td>

          <td>

            <button
              class="btn btn-secondary btn-small"
              onclick="toggleStudentStatus(${student.id})"
            >
              تغيير
            </button>

            <button
              class="btn btn-primary btn-small"
              onclick="viewStudentAttendance(${student.id})"
            >
              السجل
            </button>

          </td>

        </tr>
      `;

    }).join("");

}

async function loadEmployeeAttendance() {

  const tbody =
    $("attendanceEmployeesBody");

  if (!employeesCache.length) {
    await loadEmployees();
  }

  const rows = [];

  for (const employee of employeesCache) {

    try {

      const data =
        await api(
          `/api/employees/${employee.id}/attendance`
        );

      const records =
        data.records || [];

      if (!records.length) {

        rows.push(`
          <tr>
            <td>${escapeHTML(employee.name)}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
            <td>لا يوجد سجل</td>
            <td>-</td>
          </tr>
        `);

        continue;

      }

      const latest = records[0];

      rows.push(`
        <tr>

          <td>
            ${escapeHTML(employee.name)}
          </td>

          <td>
            ${escapeHTML(latest.date)}
          </td>

          <td>
            ${escapeHTML(
              latest.check_in || "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              latest.check_out || "-"
            )}
          </td>

          <td>
            ${escapeHTML(latest.status)}
          </td>

          <td>
            ${latest.late_minutes || 0}
            دقيقة
          </td>

        </tr>
      `);

    } catch (error) {

      console.error(error);

    }

  }

  tbody.innerHTML =
    rows.join("");

}

// =====================================================
// Attendance Tabs
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
          .classList.remove("hidden");

        $("employeeAttendancePanel")
          .classList.add("hidden");

      } else {

        $("studentAttendancePanel")
          .classList.add("hidden");

        $("employeeAttendancePanel")
          .classList.remove("hidden");

        await loadEmployeeAttendance();

      }

    });

  });

// =====================================================
// Student Attendance History
// =====================================================

async function viewStudentAttendance(id) {

  try {

    const data =
      await api(
        `/api/students/${id}/attendance`
      );

    const student =
      studentsCache.find(
        item => item.id === id
      );

    openModal(
      `سجل حضور ${student?.name || ""}`,
      `
        <div class="stats-grid">

          <div class="stat-card">
            <span>الحضور</span>
            <strong>${data.present}</strong>
          </div>

          <div class="stat-card">
            <span>الغياب</span>
            <strong>${data.absent}</strong>
          </div>

          <div class="stat-card">
            <span>النسبة</span>
            <strong>${data.percentage}%</strong>
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

                    <td>
                      ${escapeHTML(record.date)}
                    </td>

                    <td>
                      ${escapeHTML(record.status)}
                    </td>

                  </tr>
                `).join("")
              }

            </tbody>

          </table>

        </div>
      `
    );

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}

// =====================================================
// Employee Attendance
// =====================================================

async function showEmployeeAttendance(id) {

  try {

    const data =
      await api(
        `/api/employees/${id}/attendance`
      );

    const employee =
      employeesCache.find(
        item => item.id === id
      );

    openModal(
      `حضور ${employee?.name || ""}`,
      `
        <div class="stats-grid">

          <div class="stat-card">
            <span>الحضور</span>
            <strong>${data.present}</strong>
          </div>

          <div class="stat-card">
            <span>الغياب</span>
            <strong>${data.absent}</strong>
          </div>

          <div class="stat-card">
            <span>التأخير</span>
            <strong>${data.late}</strong>
          </div>

        </div>

        <div class="table-wrapper">

          <table>

            <thead>

              <tr>
                <th>التاريخ</th>
                <th>الدخول</th>
                <th>الخروج</th>
                <th>الحالة</th>
                <th>التأخير</th>
              </tr>

            </thead>

            <tbody>

              ${
                data.records.map(record => `
                  <tr>

                    <td>
                      ${escapeHTML(record.date)}
                    </td>

                    <td>
                      ${escapeHTML(
                        record.check_in || "-"
                      )}
                    </td>

                    <td>
                      ${escapeHTML(
                        record.check_out || "-"
                      )}
                    </td>

                    <td>
                      ${escapeHTML(record.status)}
                    </td>

                    <td>
                      ${record.late_minutes || 0}
                      دقيقة
                    </td>

                  </tr>
                `).join("")
              }

            </tbody>

          </table>

        </div>
      `
    );

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}

// =====================================================
// Payroll
// =====================================================

async function loadPayroll() {

  if (!employeesCache.length) {
    await loadEmployees();
  }

  const tbody =
    $("payrollTableBody");

  if (!employeesCache.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          لا يوجد موظفون
        </td>
      </tr>
    `;

    return;
  }

  const rows = [];

  for (const employee of employeesCache) {

    try {

      const data =
        await api(
          `/api/employees/${employee.id}/payroll`
        );

      rows.push(`
        <tr>

          <td>
            <strong>
              ${escapeHTML(employee.name)}
            </strong>
          </td>

          <td>
            ${Number(data.basic_salary).toLocaleString("ar-EG")}
          </td>

          <td>
            ${Number(data.allowance).toLocaleString("ar-EG")}
          </td>

          <td>
            ${Number(data.bonuses).toLocaleString("ar-EG")}
          </td>

          <td>
            ${Number(data.deductions).toLocaleString("ar-EG")}
          </td>

          <td>
            <strong>
              ${Number(data.net).toLocaleString("ar-EG")}
            </strong>
          </td>

          <td>

            <button
              class="btn btn-primary btn-small"
              onclick="showEmployeePayroll(${employee.id})"
            >
              كشف
            </button>

          </td>

        </tr>
      `);

    } catch (error) {

      console.error(error);

    }

  }

  tbody.innerHTML =
    rows.join("");

}

// =====================================================
// Employee Payroll
// =====================================================

async function showEmployeePayroll(id) {

  try {

    const data =
      await api(
        `/api/employees/${id}/payroll`
      );

    const employee =
      employeesCache.find(
        item => item.id === id
      );

    openModal(
      `كشف راتب ${employee?.name || ""}`,
      `
        <div class="payroll-details">

          <p>
            <strong>الشهر:</strong>
            ${escapeHTML(data.month)}
          </p>

          <hr>

          <p>
            الأساسي:
            ${Number(data.basic_salary).toLocaleString("ar-EG")}
          </p>

          <p>
            البدلات:
            ${Number(data.allowance).toLocaleString("ar-EG")}
          </p>

          <p>
            المكافآت:
            ${Number(data.bonuses).toLocaleString("ar-EG")}
          </p>

          <p>
            الخصومات:
            ${Number(data.deductions).toLocaleString("ar-EG")}
          </p>

          <hr>

          <h2>
            الصافي:
            ${Number(data.net).toLocaleString("ar-EG")}
          </h2>

        </div>
      `
    );

  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}

// =====================================================
// Payroll Settings
// =====================================================

$("payrollSettingsButton")
  ?.addEventListener("click", async () => {

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
              min="0"
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
              min="0"
              value="${settings.late_deduction}"
            >

          </div>

          <div class="form-group">

            <label>
              الدقائق المسموحة للتأخير
            </label>

            <input
              id="allowedLateMinutes"
              type="number"
              min="0"
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

      $("payrollSettingsForm")
        ?.addEventListener(
          "submit",
          async event => {

            event.preventDefault();

            try {

              await api(
                "/api/payroll-settings",
                {
                  method: "PATCH",

                  body: JSON.stringify({

                    absence_deduction:
                      Number(
                        $("absenceDeduction").value
                      ),

                    late_deduction:
                      Number(
                        $("lateDeduction").value
                      ),

                    allowed_late_minutes:
                      Number(
                        $("allowedLateMinutes").value
                      )

                  })

                }
              );

              closeModal();

              showToast(
                "تم حفظ إعدادات الرواتب"
              );

              await loadPayroll();

            } catch (error) {

              showToast(
                error.message,
                "error"
              );

            }

          }
        );

    } catch (error) {

      showToast(
        error.message,
        "error"
      );

    }

  });

// =====================================================
// Notes
// =====================================================

async function loadNotes() {

  if (!studentsCache.length) {
    studentsCache =
      await api("/api/students");
  }

  populateStudentSelect();

  const tbody =
    $("notesTableBody");

  const allNotes = [];

  for (const student of studentsCache) {

    try {

      const notes =
        await api(
          `/api/notes/${student.id}`
        );

      notes.forEach(note => {

        allNotes.push({
          ...note,
          student_name: student.name
        });

      });

    } catch (error) {

      console.error(error);

    }

  }

  notesCache = allNotes;

  if (!allNotes.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          لا توجد ملاحظات
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    allNotes.map(note => `

      <tr>

        <td>
          ${escapeHTML(note.student_name)}
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

    `).join("");

}

// =====================================================
// Student Select
// =====================================================

function populateStudentSelect() {

  const select =
    $("noteStudent");

  if (!select) return;

  const current =
    select.value;

  select.innerHTML = `
    <option value="">
      اختر الطالب
    </option>
  `;

  studentsCache.forEach(student => {

    const option =
      document.createElement("option");

    option.value =
      student.id;

    option.textContent =
      student.name;

    select.appendChild(option);

  });

  select.value = current;

}

// =====================================================
// Save Note
// =====================================================

$("saveNoteButton")
  ?.addEventListener("click", async () => {

    const studentId =
      $("noteStudent").value;

    const text =
      $("noteText").value.trim();

    if (!studentId) {

      showToast(
        "اختر الطالب",
        "warning"
      );

      return;

    }

    if (!text) {

      showToast(
        "اكتب الملاحظة",
        "warning"
      );

      return;

    }

    try {

      await api("/api/notes", {
        method: "POST",

        body: JSON.stringify({

          student_id:
            Number(studentId),

          text

        })

      });

      $("noteText").value = "";

      showToast(
        "تم حفظ الملاحظة"
      );

      await loadNotes();

    } catch (error) {

      showToast(
        error.message,
        "error"
      );

    }

  });

// =====================================================
// Delete Note
// =====================================================

async function deleteNote(id) {

  if (!confirm("هل تريد حذف الملاحظة؟")) {
    return;
  }

  try {

    await api(
      `/api/notes/${id}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "تم حذف الملاحظة"
    );

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

async function loadVideos() {

  videosCache =
    await api("/api/videos");

  const grid =
    $("videosGrid");

  if (!videosCache.length) {

    grid.innerHTML = `
      <div class="card">
        لا توجد حصص أو فيديوهات حالياً
      </div>
    `;

    return;
  }

  grid.innerHTML =
    videosCache.map(video => `

      <div class="card video-card">

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
                class="btn btn-primary"
              >
                مشاهدة
              </a>
            `
            : `
              <span class="badge">
                لم تتم إضافة رابط الفيديو
              </span>
            `
        }

        <div class="small-text">
          ${formatDate(video.created_at)}
        </div>

      </div>

    `).join("");

}

// =====================================================
// Add Video
// =====================================================

$("addVideoButton")
  ?.addEventListener("click", () => {

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
            رابط الفيديو
          </label>

          <input
            id="videoFile"
            placeholder="https://..."
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

    $("addVideoForm")
      ?.addEventListener("submit", async event => {

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

          showToast(
            "تمت إضافة الحصة"
          );

          await loadVideos();

        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      });

  });

// =====================================================
// Logs
// =====================================================

async function loadLogs() {

  const logs =
    await api("/api/audit-logs");

  const tbody =
    $("logsTableBody");

  if (!logs.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          لا توجد عمليات
        </td>
      </tr>
    `;

    return;

  }

  tbody.innerHTML =
    logs.map((log, index) => `

      <tr>

        <td>
          ${index + 1}
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
          ${escapeHTML(log.details)}
        </td>

        <td>
          ${formatDate(log.created_at)}
        </td>

      </tr>

    `).join("");

}

$("refreshLogs")
  ?.addEventListener("click", async () => {

    try {

      await loadLogs();

      showToast(
        "تم تحديث سجل العمليات"
      );

    } catch (error) {

      showToast(
        error.message,
        "error"
      );

    }

  });

// =====================================================
// Refresh Student Attendance
// =====================================================

$("refreshStudentAttendance")
  ?.addEventListener("click", async () => {

    await loadStudentAttendance();

    showToast(
      "تم تحديث الحضور"
    );

  });

// =====================================================
// Activity / Online Status
// =====================================================

async function sendActivity() {

  if (!currentUser?.id) return;

  try {

    await api("/api/activity", {

      method: "POST",

      body: JSON.stringify({
        user_id: currentUser.id
      })

    });

  } catch (error) {

    console.error(
      "Activity error:",
      error
    );

  }

}

// تحديث حالة المستخدم كل 30 ثانية
setInterval(() => {

  if (currentUser) {
    sendActivity();
  }

}, 30000);

// =====================================================
// Restore Login
// =====================================================

function restoreSession() {

  try {

    const saved =
      localStorage.getItem(
        "school_current_user"
      );

    if (!saved) return;

    const user =
      JSON.parse(saved);

    if (!user?.id) return;

    currentUser = user;

    showApp();

    sendActivity();

  } catch (error) {

    console.error(
      "Session restore error:",
      error
    );

    localStorage.removeItem(
      "school_current_user"
    );

  }

}

// =====================================================
// Initial Load
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    restoreSession();

  }
);

// =====================================================
// تحديث البيانات كل دقيقة
// =====================================================

setInterval(async () => {

  if (!currentUser) return;

  if (
    currentPage === "dashboard"
  ) {

    await loadDashboard();

  }

  if (
    currentPage === "users"
  ) {

    await loadUsers();

  }

}, 60000);

// =====================================================
// Expose functions for HTML onclick
// =====================================================

window.disableUser =
  disableUser;

window.enableUser =
  enableUser;

window.deleteUser =
  deleteUser;

window.changeUserPassword =
  changeUserPassword;

window.toggleStudentStatus =
  toggleStudentStatus;

window.viewStudentAttendance =
  viewStudentAttendance;

window.viewEmployee =
  viewEmployee;

window.showEmployeeAttendance =
  showEmployeeAttendance;

window.showEmployeePayroll =
  showEmployeePayroll;

window.deleteNote =
  deleteNote;

// =====================================================
// End
// =====================================================
