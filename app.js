"use strict";

/* =========================================================
   British Education School Portal
   app.js
========================================================= */

const $ = (id) => document.getElementById(id);

const loginPage = $("loginPage");
const appPage = $("appPage");

const loginBox = $("loginBox");
const registerBox = $("registerBox");

const loginForm = $("loginForm");
const registerForm = $("registerForm");

const loginMessage = $("loginMessage");
const registerMessage = $("registerMessage");

const showRegisterButton = $("showRegisterButton");
const backToLoginButton = $("backToLoginButton");

const logoutButton = $("logoutButton");
const menuButton = $("menuButton");
const sidebar = $("sidebar");

const currentUserName = $("currentUserName");

const modal = $("modal");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const modalClose = $("modalClose");

const toast = $("toast");


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let users = [];
let students = [];
let employees = [];
let attendanceStudents = [];
let attendanceEmployees = [];
let payroll = [];
let notes = [];
let videos = [];
let logs = [];


/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function showToast(message, type = "success") {
  if (!toast) return;

  toast.textContent = message;

  toast.className = "toast";

  if (type === "error") {
    toast.classList.add("toast-error");
  } else {
    toast.classList.add("toast-success");
  }

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


function setMessage(element, message, type = "error") {
  if (!element) return;

  element.textContent = message;

  element.style.color =
    type === "success"
      ? "#16803c"
      : "#c62828";
}


function formatDate(date) {
  if (!date) return "-";

  try {
    return new Date(date).toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return date;
  }
}


function today() {
  return new Date().toISOString().split("T")[0];
}


async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `خطأ في الاتصال (${response.status})`
    );
  }

  return data;
}


/* =========================================================
   MODAL
========================================================= */

function openModal(title, html) {
  if (!modal) return;

  modalTitle.textContent = title;
  modalBody.innerHTML = html;

  modal.classList.remove("hidden");
}


function closeModal() {
  if (!modal) return;

  modal.classList.add("hidden");
  modalBody.innerHTML = "";
}


if (modalClose) {
  modalClose.addEventListener("click", closeModal);
}


if (modal) {
  modal.addEventListener("click", (event) => {
    if (
      event.target.classList.contains("modal-overlay")
    ) {
      closeModal();
    }
  });
}


/* =========================================================
   LOGIN / REGISTER
========================================================= */

if (showRegisterButton) {
  showRegisterButton.addEventListener("click", () => {
    loginBox.classList.add("hidden");
    registerBox.classList.remove("hidden");

    setMessage(registerMessage, "");
  });
}


if (backToLoginButton) {
  backToLoginButton.addEventListener("click", () => {
    registerBox.classList.add("hidden");
    loginBox.classList.remove("hidden");

    setMessage(registerMessage, "");
  });
}


/* =========================================================
   REGISTER
========================================================= */

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name =
      $("registerName").value.trim();

    const username =
      $("registerUsername").value.trim();

    const password =
      $("registerPassword").value;

    const confirmPassword =
      $("registerPasswordConfirm").value;


    if (!name || !username || !password) {
      setMessage(
        registerMessage,
        "أكمل جميع البيانات"
      );
      return;
    }


    if (username.length < 3) {
      setMessage(
        registerMessage,
        "اسم المستخدم يجب أن يكون 3 أحرف على الأقل"
      );
      return;
    }


    if (password.length < 4) {
      setMessage(
        registerMessage,
        "كلمة المرور يجب أن تكون 4 أحرف على الأقل"
      );
      return;
    }


    if (password !== confirmPassword) {
      setMessage(
        registerMessage,
        "كلمتا المرور غير متطابقتين"
      );
      return;
    }


    setMessage(
      registerMessage,
      "جاري إنشاء الحساب...",
      "success"
    );


    try {
      const data = await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          name,
          role: "user"
        })
      });


      setMessage(
        registerMessage,
        data.message ||
        "تم إنشاء الحساب بنجاح ✅",
        "success"
      );


      registerForm.reset();


      setTimeout(() => {
        registerBox.classList.add("hidden");
        loginBox.classList.remove("hidden");

        $("username").value = username;
        $("password").value = "";

        setMessage(registerMessage, "");
      }, 1000);


    } catch (error) {
      console.error(error);

      setMessage(
        registerMessage,
        error.message ||
        "تعذر إنشاء الحساب"
      );
    }
  });
}


/* =========================================================
   LOGIN
========================================================= */

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username =
      $("username").value.trim();

    const password =
      $("password").value;


    if (!username || !password) {
      setMessage(
        loginMessage,
        "أدخل اسم المستخدم وكلمة المرور"
      );
      return;
    }


    setMessage(
      loginMessage,
      "جاري تسجيل الدخول...",
      "success"
    );


    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password
        })
      });


      currentUser =
        data.user ||
        data;


      localStorage.setItem(
        "schoolUser",
        JSON.stringify(currentUser)
      );


      loginForm.reset();

      showApplication();

      showToast("تم تسجيل الدخول بنجاح ✅");


    } catch (error) {
      console.error(error);

      setMessage(
        loginMessage,
        error.message ||
        "اسم المستخدم أو كلمة المرور غير صحيحة"
      );
    }
  });
}


/* =========================================================
   SHOW APPLICATION
========================================================= */

function showApplication() {
  loginPage.classList.add("hidden");
  appPage.classList.remove("hidden");

  if (currentUserName) {
    currentUserName.textContent =
      currentUser?.name ||
      currentUser?.username ||
      "المستخدم";
  }

  loadDashboard();
}


/* =========================================================
   LOGOUT
========================================================= */

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {

    try {
      await api("/api/logout", {
        method: "POST"
      });
    } catch {
      // حتى لو السيرفر لم ينفذ logout
    }


    currentUser = null;

    localStorage.removeItem("schoolUser");

    appPage.classList.add("hidden");
    loginPage.classList.remove("hidden");

    loginBox.classList.remove("hidden");
    registerBox.classList.add("hidden");

    setMessage(loginMessage, "");

    showToast("تم تسجيل الخروج");
  });
}


/* =========================================================
   NAVIGATION
========================================================= */

document.querySelectorAll(".nav-item")
  .forEach((button) => {

    button.addEventListener("click", () => {

      const page =
        button.dataset.page;

      switchPage(page);

    });

  });


function switchPage(page) {

  document.querySelectorAll(".page-section")
    .forEach((section) => {
      section.classList.add("hidden");
    });


  const target =
    $(`page-${page}`);

  if (target) {
    target.classList.remove("hidden");
  }


  document.querySelectorAll(".nav-item")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });


  if (page === "dashboard") {
    loadDashboard();
  }

  if (page === "users") {
    loadUsers();
  }

  if (page === "students") {
    loadStudents();
  }

  if (page === "employees") {
    loadEmployees();
  }

  if (page === "attendance") {
    loadAttendance();
  }

  if (page === "payroll") {
    loadPayroll();
  }

  if (page === "notes") {
    loadNotes();
  }

  if (page === "videos") {
    loadVideos();
  }

  if (page === "logs") {
    loadLogs();
  }


  if (
    window.innerWidth <= 650 &&
    sidebar
  ) {
    sidebar.style.display = "none";

    setTimeout(() => {
      sidebar.style.display = "";
    }, 100);
  }
}


/* =========================================================
   MENU
========================================================= */

if (menuButton) {

  menuButton.addEventListener("click", () => {

    if (!sidebar) return;

    if (window.innerWidth <= 650) {

      if (
        sidebar.style.display === "none"
      ) {
        sidebar.style.display = "block";
      } else {
        sidebar.style.display = "none";
      }

    }

  });

}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

  try {

    const data =
      await api("/api/dashboard");


    const stats =
      data.stats ||
      data;


    if ($("statUsers")) {
      $("statUsers").textContent =
        stats.users ??
        stats.totalUsers ??
        0;
    }


    if ($("statOnline")) {
      $("statOnline").textContent =
        stats.online ??
        stats.onlineUsers ??
        0;
    }


    if ($("statStudents")) {
      $("statStudents").textContent =
        stats.students ??
        stats.totalStudents ??
        0;
    }


    if ($("statEmployees")) {
      $("statEmployees").textContent =
        stats.employees ??
        stats.totalEmployees ??
        0;
    }


    if ($("healthStatus")) {
      $("healthStatus").innerHTML =
        `<span style="color:#16803c;font-weight:bold">
          🟢 النظام يعمل بشكل طبيعي
        </span>`;
    }


    renderOnlineUsers(
      data.onlineUsers ||
      []
    );


  } catch (error) {

    console.error(error);

    if ($("healthStatus")) {
      $("healthStatus").innerHTML =
        `<span style="color:#c62828">
          🔴 تعذر الاتصال بالسيرفر
        </span>`;
    }

  }

}


function renderOnlineUsers(list) {

  const element =
    $("onlineUsersList");

  if (!element) return;


  if (!list.length) {
    element.innerHTML =
      "لا يوجد مستخدمون متصلون الآن";
    return;
  }


  element.innerHTML =
    list.map((user) => `
      <div style="
        padding:10px;
        border-bottom:1px solid #eee;
      ">
        🟢
        <strong>
          ${escapeHTML(
            user.name ||
            user.username ||
            "مستخدم"
          )}
        </strong>
      </div>
    `).join("");
}


/* =========================================================
   REFRESH DASHBOARD
========================================================= */

if ($("refreshDashboard")) {
  $("refreshDashboard")
    .addEventListener(
      "click",
      loadDashboard
    );
}


/* =========================================================
   USERS
========================================================= */

async function loadUsers() {

  try {

    const data =
      await api("/api/users");

    users =
      Array.isArray(data)
        ? data
        : data.users || [];


    renderUsers();

  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "تعذر تحميل المستخدمين",
      "error"
    );

  }

}


function renderUsers() {

  const body =
    $("usersTableBody");

  if (!body) return;


  const active =
    users.filter(
      user =>
        user.active !== false &&
        user.status !== "disabled"
    ).length;


  const online =
    users.filter(
      user =>
        user.online === true ||
        user.is_online === true
    ).length;


  if ($("usersTotal")) {
    $("usersTotal").textContent =
      users.length;
  }


  if ($("usersActive")) {
    $("usersActive").textContent =
      active;
  }


  if ($("usersOnline")) {
    $("usersOnline").textContent =
      online;
  }


  if (!users.length) {

    body.innerHTML = `
      <tr>
        <td colspan="7">
          لا يوجد مستخدمون
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    users.map((user, index) => {

      const disabled =
        user.active === false ||
        user.status === "disabled";


      const online =
        user.online === true ||
        user.is_online === true;


      return `
        <tr>

          <td>${index + 1}</td>

          <td>
            ${escapeHTML(user.username)}
          </td>

          <td>
            ${escapeHTML(
              user.name ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(
              user.role ||
              "user"
            )}
          </td>

          <td>
            ${
              online
                ? "🟢 متصل"
                : disabled
                  ? "🔴 موقوف"
                  : "🟡 نشط"
            }
          </td>

          <td>
            ${formatDate(
              user.last_seen ||
              user.lastSeen
            )}
          </td>

          <td>

            ${
              user.role !== "admin"
              ? `
                <button
                  class="btn btn-secondary"
                  onclick="toggleUser(${user.id}, ${disabled})"
                >
                  ${
                    disabled
                      ? "▶️ تفعيل"
                      : "⛔ إيقاف"
                  }
                </button>

                <button
                  class="btn btn-danger"
                  onclick="deleteUser(${user.id})"
                >
                  حذف
                </button>
              `
              : "مدير النظام"
            }

          </td>

        </tr>
      `;

    }).join("");
}


/* =========================================================
   ADD USER
========================================================= */

if ($("addUserButton")) {

  $("addUserButton")
    .addEventListener(
      "click",
      () => {

        openModal(
          "إضافة مستخدم",
          `
          <form id="addUserForm">

            <div class="form-group">
              <label>الاسم</label>
              <input id="newUserName" required>
            </div>

            <div class="form-group">
              <label>اسم المستخدم</label>
              <input id="newUsername" required>
            </div>

            <div class="form-group">
              <label>كلمة المرور</label>
              <input
                id="newUserPassword"
                type="password"
                required
              >
            </div>

            <div class="form-group">
              <label>الصلاحية</label>
              <select id="newUserRole">
                <option value="user">
                  مستخدم
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
              إنشاء المستخدم
            </button>

          </form>
          `
        );


        $("addUserForm")
          .addEventListener(
            "submit",
            async (event) => {

              event.preventDefault();

              try {

                await api("/api/users", {
                  method: "POST",
                  body: JSON.stringify({
                    name:
                      $("newUserName").value.trim(),

                    username:
                      $("newUsername").value.trim(),

                    password:
                      $("newUserPassword").value,

                    role:
                      $("newUserRole").value
                  })
                });


                closeModal();

                showToast(
                  "تم إنشاء المستخدم بنجاح ✅"
                );

                loadUsers();


              } catch (error) {

                showToast(
                  error.message,
                  "error"
                );

              }

            }
          );

      }
    );

}


/* =========================================================
   USER ACTIONS
========================================================= */

async function toggleUser(id, disabled) {

  try {

    await api(
      `/api/users/${id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          active: disabled
        })
      }
    );


    showToast(
      disabled
        ? "تم تفعيل الحساب ✅"
        : "تم إيقاف الحساب"
    );


    loadUsers();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}


async function deleteUser(id) {

  if (
    !confirm(
      "هل أنت متأكد من حذف هذا المستخدم؟"
    )
  ) {
    return;
  }


  try {

    await api(
      `/api/users/${id}`,
      {
        method: "DELETE"
      }
    );


    showToast(
      "تم حذف المستخدم"
    );


    loadUsers();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}


/* =========================================================
   STUDENTS
========================================================= */

async function loadStudents() {

  try {

    const data =
      await api("/api/students");

    students =
      Array.isArray(data)
        ? data
        : data.students || [];


    renderStudents();

    fillStudentSelect();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "تعذر تحميل الطلاب",
      "error"
    );

  }

}


function renderStudents() {

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
    students.map((student, index) => `

      <tr>

        <td>${index + 1}</td>

        <td>
          ${escapeHTML(
            student.name ||
            student.student_name ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            student.class_name ||
            student.class ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            student.parent_phone ||
            student.phone ||
            "-"
          )}
        </td>

        <td>
          ${
            student.active === false
              ? "🔴 غير نشط"
              : "🟢 نشط"
          }
        </td>

        <td>

          <button
            class="btn btn-secondary"
            onclick="editStudent(${student.id})"
          >
            تعديل
          </button>

          <button
            class="btn btn-danger"
            onclick="deleteStudent(${student.id})"
          >
            حذف
          </button>

        </td>

      </tr>

    `).join("");
}


/* =========================================================
   ADD STUDENT
========================================================= */

if ($("addStudentButton")) {

  $("addStudentButton")
    .addEventListener(
      "click",
      () => {

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
              <input id="studentClass">
            </div>

            <div class="form-group">
              <label>هاتف ولي الأمر</label>
              <input id="parentPhone">
            </div>

            <button
              type="submit"
              class="btn btn-primary"
            >
              حفظ الطالب
            </button>

          </form>
          `
        );


        $("studentForm")
          .addEventListener(
            "submit",
            async (event) => {

              event.preventDefault();

              try {

                await api(
                  "/api/students",
                  {
                    method: "POST",
                    body: JSON.stringify({

                      name:
                        $("studentName")
                          .value
                          .trim(),

                      class_name:
                        $("studentClass")
                          .value
                          .trim(),

                      parent_phone:
                        $("parentPhone")
                          .value
                          .trim()

                    })
                  }
                );


                closeModal();

                showToast(
                  "تمت إضافة الطالب بنجاح ✅"
                );

                loadStudents();


              } catch (error) {

                showToast(
                  error.message,
                  "error"
                );

              }

            }
          );

      }
    );

}


/* =========================================================
   EDIT STUDENT
========================================================= */

function editStudent(id) {

  const student =
    students.find(
      item => Number(item.id) === Number(id)
    );


  if (!student) return;


  openModal(
    "تعديل الطالب",
    `
    <form id="editStudentForm">

      <div class="form-group">
        <label>اسم الطالب</label>
        <input
          id="editStudentName"
          value="${escapeHTML(student.name || "")}"
          required
        >
      </div>

      <div class="form-group">
        <label>الفصل</label>
        <input
          id="editStudentClass"
          value="${escapeHTML(
            student.class_name ||
            student.class ||
            ""
          )}"
        >
      </div>

      <div class="form-group">
        <label>هاتف ولي الأمر</label>
        <input
          id="editParentPhone"
          value="${escapeHTML(
            student.parent_phone ||
            student.phone ||
            ""
          )}"
        >
      </div>

      <button
        type="submit"
        class="btn btn-primary"
      >
        حفظ التعديل
      </button>

    </form>
    `
  );


  $("editStudentForm")
    .addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        try {

          await api(
            `/api/students/${id}`,
            {
              method: "PUT",
              body: JSON.stringify({

                name:
                  $("editStudentName")
                    .value.trim(),

                class_name:
                  $("editStudentClass")
                    .value.trim(),

                parent_phone:
                  $("editParentPhone")
                    .value.trim()

              })
            }
          );


          closeModal();

          showToast(
            "تم تعديل بيانات الطالب ✅"
          );

          loadStudents();


        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      }
    );

}


async function deleteStudent(id) {

  if (
    !confirm(
      "هل تريد حذف هذا الطالب؟"
    )
  ) {
    return;
  }


  try {

    await api(
      `/api/students/${id}`,
      {
        method: "DELETE"
      }
    );


    showToast(
      "تم حذف الطالب"
    );

    loadStudents();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}


/* =========================================================
   EMPLOYEES
========================================================= */

async function loadEmployees() {

  try {

    const data =
      await api("/api/employees");

    employees =
      Array.isArray(data)
        ? data
        : data.employees || [];


    renderEmployees();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "تعذر تحميل الموظفين",
      "error"
    );

  }

}


function renderEmployees() {

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
    employees.map((employee, index) => `

      <tr>

        <td>${index + 1}</td>

        <td>
          ${escapeHTML(
            employee.employee_number ||
            employee.employee_no ||
            employee.id ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            employee.name ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            employee.job ||
            employee.position ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            employee.department ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            employee.phone ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            employee.salary ||
            0
          )}
        </td>

        <td>
          ${
            employee.active === false
              ? "🔴 غير نشط"
              : "🟢 نشط"
          }
        </td>

        <td>

          <button
            class="btn btn-secondary"
            onclick="editEmployee(${employee.id})"
          >
            تعديل
          </button>

          <button
            class="btn btn-danger"
            onclick="deleteEmployee(${employee.id})"
          >
            حذف
          </button>

        </td>

      </tr>

    `).join("");
}


/* =========================================================
   ADD EMPLOYEE
========================================================= */

if ($("addEmployeeButton")) {

  $("addEmployeeButton")
    .addEventListener(
      "click",
      () => {

        openModal(
          "إضافة موظف",
          `
          <form id="employeeForm">

            <div class="form-group">
              <label>رقم الموظف</label>
              <input id="employeeNumber">
            </div>

            <div class="form-group">
              <label>الاسم</label>
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
              <label>الراتب</label>
              <input
                id="employeeSalary"
                type="number"
                min="0"
              >
            </div>

            <button
              type="submit"
              class="btn btn-primary"
            >
              حفظ الموظف
            </button>

          </form>
          `
        );


        $("employeeForm")
          .addEventListener(
            "submit",
            async (event) => {

              event.preventDefault();

              try {

                await api(
                  "/api/employees",
                  {
                    method: "POST",
                    body: JSON.stringify({

                      employee_number:
                        $("employeeNumber")
                          .value.trim(),

                      name:
                        $("employeeName")
                          .value.trim(),

                      job:
                        $("employeeJob")
                          .value.trim(),

                      department:
                        $("employeeDepartment")
                          .value.trim(),

                      phone:
                        $("employeePhone")
                          .value.trim(),

                      salary:
                        Number(
                          $("employeeSalary")
                            .value || 0
                        )

                    })
                  }
                );


                closeModal();

                showToast(
                  "تمت إضافة الموظف بنجاح ✅"
                );

                loadEmployees();


              } catch (error) {

                showToast(
                  error.message,
                  "error"
                );

              }

            }
          );

      }
    );

}


/* =========================================================
   EDIT EMPLOYEE
========================================================= */

function editEmployee(id) {

  const employee =
    employees.find(
      item => Number(item.id) === Number(id)
    );


  if (!employee) return;


  openModal(
    "تعديل الموظف",
    `
    <form id="editEmployeeForm">

      <div class="form-group">
        <label>الاسم</label>
        <input
          id="editEmployeeName"
          value="${escapeHTML(
            employee.name || ""
          )}"
          required
        >
      </div>

      <div class="form-group">
        <label>الوظيفة</label>
        <input
          id="editEmployeeJob"
          value="${escapeHTML(
            employee.job ||
            employee.position ||
            ""
          )}"
        >
      </div>

      <div class="form-group">
        <label>القسم</label>
        <input
          id="editEmployeeDepartment"
          value="${escapeHTML(
            employee.department || ""
          )}"
        >
      </div>

      <div class="form-group">
        <label>الهاتف</label>
        <input
          id="editEmployeePhone"
          value="${escapeHTML(
            employee.phone || ""
          )}"
        >
      </div>

      <div class="form-group">
        <label>الراتب</label>
        <input
          id="editEmployeeSalary"
          type="number"
          value="${escapeHTML(
            employee.salary || 0
          )}"
        >
      </div>

      <button
        type="submit"
        class="btn btn-primary"
      >
        حفظ التعديل
      </button>

    </form>
    `
  );


  $("editEmployeeForm")
    .addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        try {

          await api(
            `/api/employees/${id}`,
            {
              method: "PUT",
              body: JSON.stringify({

                name:
                  $("editEmployeeName")
                    .value.trim(),

                job:
                  $("editEmployeeJob")
                    .value.trim(),

                department:
                  $("editEmployeeDepartment")
                    .value.trim(),

                phone:
                  $("editEmployeePhone")
                    .value.trim(),

                salary:
                  Number(
                    $("editEmployeeSalary")
                      .value || 0
                  )

              })
            }
          );


          closeModal();

          showToast(
            "تم تعديل بيانات الموظف ✅"
          );

          loadEmployees();


        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      }
    );

}


async function deleteEmployee(id) {

  if (
    !confirm(
      "هل تريد حذف هذا الموظف؟"
    )
  ) {
    return;
  }


  try {

    await api(
      `/api/employees/${id}`,
      {
        method: "DELETE"
      }
    );


    showToast(
      "تم حذف الموظف"
    );

    loadEmployees();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}


/* =========================================================
   ATTENDANCE
========================================================= */

async function loadAttendance() {

  await Promise.all([
    loadStudentAttendance(),
    loadEmployeeAttendance()
  ]);

}


async function loadStudentAttendance() {

  try {

    const data =
      await api(
        "/api/attendance/students"
      );


    attendanceStudents =
      Array.isArray(data)
        ? data
        : data.attendance || [];


    renderStudentAttendance();


  } catch (error) {

    console.error(error);

  }

}


function renderStudentAttendance() {

  const body =
    $("attendanceStudentsBody");

  if (!body) return;


  if (!attendanceStudents.length) {

    body.innerHTML = `
      <tr>
        <td colspan="4">
          لا توجد بيانات حضور
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    attendanceStudents.map(
      (item) => `

      <tr>

        <td>
          ${escapeHTML(
            item.student_name ||
            item.name ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            item.class_name ||
            item.class ||
            "-"
          )}
        </td>

        <td>
          ${
            item.status === "present"
              ? "🟢 حاضر"
              : item.status === "absent"
                ? "🔴 غائب"
                : "🟡 لم يسجل"
          }
        </td>

        <td>

          <button
            class="btn btn-primary"
            onclick="markAttendance(${item.student_id || item.id}, 'present')"
          >
            حاضر
          </button>

          <button
            class="btn btn-danger"
            onclick="markAttendance(${item.student_id || item.id}, 'absent')"
          >
            غائب
          </button>

        </td>

      </tr>

    `
    ).join("");
}


async function markAttendance(studentId, status) {

  try {

    await api(
      "/api/attendance/students",
      {
        method: "POST",
        body: JSON.stringify({

          student_id:
            studentId,

          status,

          date:
            today()

        })
      }
    );


    showToast(
      status === "present"
        ? "تم تسجيل الحضور ✅"
        : "تم تسجيل الغياب"
    );


    loadStudentAttendance();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}


async function loadEmployeeAttendance() {

  try {

    const data =
      await api(
        "/api/attendance/employees"
      );


    attendanceEmployees =
      Array.isArray(data)
        ? data
        : data.attendance || [];


    renderEmployeeAttendance();


  } catch (error) {

    console.error(error);

  }

}


function renderEmployeeAttendance() {

  const body =
    $("attendanceEmployeesBody");

  if (!body) return;


  if (!attendanceEmployees.length) {

    body.innerHTML = `
      <tr>
        <td colspan="6">
          لا توجد بيانات حضور
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    attendanceEmployees.map(
      item => `

      <tr>

        <td>
          ${escapeHTML(
            item.employee_name ||
            item.name ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            item.date ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            item.check_in ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            item.check_out ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            item.status ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            item.late_minutes ??
            0
          )}
        </td>

      </tr>

    `
    ).join("");
}


if ($("refreshStudentAttendance")) {

  $("refreshStudentAttendance")
    .addEventListener(
      "click",
      loadAttendance
    );

}


/* =========================================================
   PAYROLL
========================================================= */

async function loadPayroll() {

  try {

    const data =
      await api("/api/payroll");

    payroll =
      Array.isArray(data)
        ? data
        : data.payroll || [];


    renderPayroll();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "تعذر تحميل الرواتب",
      "error"
    );

  }

}


function renderPayroll() {

  const body =
    $("payrollTableBody");

  if (!body) return;


  if (!payroll.length) {

    body.innerHTML = `
      <tr>
        <td colspan="7">
          لا توجد بيانات رواتب
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    payroll.map(item => {

      const basic =
        Number(item.basic || 0);

      const allowances =
        Number(item.allowances || 0);

      const bonuses =
        Number(item.bonuses || 0);

      const deductions =
        Number(item.deductions || 0);

      const net =
        basic +
        allowances +
        bonuses -
        deductions;


      return `

      <tr>

        <td>
          ${escapeHTML(
            item.employee_name ||
            item.name ||
            "-"
          )}
        </td>

        <td>
          ${basic}
        </td>

        <td>
          ${allowances}
        </td>

        <td>
          ${bonuses}
        </td>

        <td>
          ${deductions}
        </td>

        <td>
          <strong>
            ${net}
          </strong>
        </td>

        <td>

          <button
            class="btn btn-secondary"
            onclick="editPayroll(${item.id})"
          >
            تعديل
          </button>

        </td>

      </tr>

      `;

    }).join("");
}


function editPayroll(id) {

  const item =
    payroll.find(
      row => Number(row.id) === Number(id)
    );


  if (!item) return;


  openModal(
    "تعديل الراتب",
    `
    <form id="payrollForm">

      <div class="form-group">
        <label>الأساسي</label>
        <input
          id="payrollBasic"
          type="number"
          value="${item.basic || 0}"
        >
      </div>

      <div class="form-group">
        <label>البدلات</label>
        <input
          id="payrollAllowances"
          type="number"
          value="${item.allowances || 0}"
        >
      </div>

      <div class="form-group">
        <label>المكافآت</label>
        <input
          id="payrollBonuses"
          type="number"
          value="${item.bonuses || 0}"
        >
      </div>

      <div class="form-group">
        <label>الخصومات</label>
        <input
          id="payrollDeductions"
          type="number"
          value="${item.deductions || 0}"
        >
      </div>

      <button
        class="btn btn-primary"
        type="submit"
      >
        حفظ
      </button>

    </form>
    `
  );


  $("payrollForm")
    .addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        try {

          await api(
            `/api/payroll/${id}`,
            {
              method: "PUT",
              body: JSON.stringify({

                basic:
                  Number(
                    $("payrollBasic").value || 0
                  ),

                allowances:
                  Number(
                    $("payrollAllowances").value || 0
                  ),

                bonuses:
                  Number(
                    $("payrollBonuses").value || 0
                  ),

                deductions:
                  Number(
                    $("payrollDeductions").value || 0
                  )

              })
            }
          );


          closeModal();

          showToast(
            "تم تحديث الراتب ✅"
          );

          loadPayroll();


        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      }
    );

}


if ($("payrollSettingsButton")) {

  $("payrollSettingsButton")
    .addEventListener(
      "click",
      () => {

        openModal(
          "إعدادات الرواتب",
          `
          <p>
            إعدادات الرواتب متاحة من خلال
            بيانات الموظفين والرواتب.
          </p>

          <button
            class="btn btn-secondary"
            onclick="closeModal()"
          >
            إغلاق
          </button>
          `
        );

      }
    );

}


/* =========================================================
   NOTES
========================================================= */

async function loadNotes() {

  try {

    const data =
      await api("/api/notes");

    notes =
      Array.isArray(data)
        ? data
        : data.notes || [];


    renderNotes();

    await loadStudents();

    fillStudentSelect();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "تعذر تحميل الملاحظات",
      "error"
    );

  }

}


function fillStudentSelect() {

  const select =
    $("noteStudent");

  if (!select) return;


  select.innerHTML = `
    <option value="">
      اختر الطالب
    </option>
  `;


  students.forEach(student => {

    select.innerHTML += `
      <option value="${student.id}">
        ${escapeHTML(
          student.name ||
          student.student_name ||
          ""
        )}
      </option>
    `;

  });

}


function renderNotes() {

  const body =
    $("notesTableBody");

  if (!body) return;


  if (!notes.length) {

    body.innerHTML = `
      <tr>
        <td colspan="4">
          لا توجد ملاحظات
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    notes.map(
      note => `

      <tr>

        <td>
          ${escapeHTML(
            note.student_name ||
            note.student ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            note.note ||
            note.text ||
            "-"
          )}
        </td>

        <td>
          ${formatDate(
            note.created_at ||
            note.date
          )}
        </td>

        <td>

          <button
            class="btn btn-danger"
            onclick="deleteNote(${note.id})"
          >
            حذف
          </button>

        </td>

      </tr>

    `
    ).join("");
}


if ($("saveNoteButton")) {

  $("saveNoteButton")
    .addEventListener(
      "click",
      async () => {

        const studentId =
          $("noteStudent").value;

        const text =
          $("noteText")
            .value
            .trim();


        if (!studentId) {

          showToast(
            "اختر الطالب أولاً",
            "error"
          );

          return;
        }


        if (!text) {

          showToast(
            "اكتب الملاحظة",
            "error"
          );

          return;
        }


        try {

          await api(
            "/api/notes",
            {
              method: "POST",
              body: JSON.stringify({

                student_id:
                  Number(studentId),

                note:
                  text

              })
            }
          );


          $("noteText").value = "";

          $("noteStudent").value = "";

          showToast(
            "تم حفظ الملاحظة ✅"
          );


          loadNotes();


        } catch (error) {

          showToast(
            error.message,
            "error"
          );

        }

      }
    );

}


async function deleteNote(id) {

  if (
    !confirm(
      "هل تريد حذف هذه الملاحظة؟"
    )
  ) {
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

    loadNotes();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}


/* =========================================================
   VIDEOS
========================================================= */

async function loadVideos() {

  try {

    const data =
      await api("/api/videos");

    videos =
      Array.isArray(data)
        ? data
        : data.videos || [];


    renderVideos();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "تعذر تحميل الحصص",
      "error"
    );

  }

}


function renderVideos() {

  const grid =
    $("videosGrid");

  if (!grid) return;


  if (!videos.length) {

    grid.innerHTML = `
      <div class="card">
        لا توجد حصص أو فيديوهات حالياً.
      </div>
    `;

    return;
  }


  grid.innerHTML =
    videos.map(video => `

      <div class="card">

        <h3>
          ${escapeHTML(
            video.title ||
            "حصة تعليمية"
          )}
        </h3>

        <p>
          ${escapeHTML(
            video.description ||
            ""
          )}
        </p>

        ${
          video.url
          ? `
            <a
              href="${escapeHTML(video.url)}"
              target="_blank"
              rel="noopener"
              class="btn btn-primary"
            >
              ▶️ مشاهدة الحصة
            </a>
          `
          : `
            <span>
              لا يوجد رابط للفيديو
            </span>
          `
        }

        <br><br>

        <button
          class="btn btn-danger"
          onclick="deleteVideo(${video.id})"
        >
          حذف
        </button>

      </div>

    `).join("");
}


/* =========================================================
   ADD VIDEO
========================================================= */

if ($("addVideoButton")) {

  $("addVideoButton")
    .addEventListener(
      "click",
      () => {

        openModal(
          "إضافة حصة",
          `
          <form id="videoForm">

            <div class="form-group">
              <label>اسم الحصة</label>
              <input id="videoTitle" required>
            </div>

            <div class="form-group">
              <label>الوصف</label>
              <textarea id="videoDescription"></textarea>
            </div>

            <div class="form-group">
              <label>رابط الفيديو</label>
              <input
                id="videoUrl"
                type="url"
                placeholder="https://..."
                required
              >
            </div>

            <button
              type="submit"
              class="btn btn-primary"
            >
              حفظ الحصة
            </button>

          </form>
          `
        );


        $("videoForm")
          .addEventListener(
            "submit",
            async (event) => {

              event.preventDefault();

              try {

                await api(
                  "/api/videos",
                  {
                    method: "POST",
                    body: JSON.stringify({

                      title:
                        $("videoTitle")
                          .value.trim(),

                      description:
                        $("videoDescription")
                          .value.trim(),

                      url:
                        $("videoUrl")
                          .value.trim()

                    })
                  }
                );


                closeModal();

                showToast(
                  "تمت إضافة الحصة ✅"
                );

                loadVideos();


              } catch (error) {

                showToast(
                  error.message,
                  "error"
                );

              }

            }
          );

      }
    );

}


async function deleteVideo(id) {

  if (
    !confirm(
      "هل تريد حذف هذه الحصة؟"
    )
  ) {
    return;
  }


  try {

    await api(
      `/api/videos/${id}`,
      {
        method: "DELETE"
      }
    );


    showToast(
      "تم حذف الحصة"
    );

    loadVideos();


  } catch (error) {

    showToast(
      error.message,
      "error"
    );

  }

}


/* =========================================================
   LOGS
========================================================= */

async function loadLogs() {

  try {

    const data =
      await api("/api/logs");

    logs =
      Array.isArray(data)
        ? data
        : data.logs || [];


    renderLogs();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "تعذر تحميل سجل العمليات",
      "error"
    );

  }

}


function renderLogs() {

  const body =
    $("logsTableBody");

  if (!body) return;


  if (!logs.length) {

    body.innerHTML = `
      <tr>
        <td colspan="5">
          لا توجد عمليات
        </td>
      </tr>
    `;

    return;
  }


  body.innerHTML =
    logs.map(
      (log, index) => `

      <tr>

        <td>
          ${index + 1}
        </td>

        <td>
          ${escapeHTML(
            log.username ||
            log.user_name ||
            log.user ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            log.action ||
            "-"
          )}
        </td>

        <td>
          ${escapeHTML(
            log.details ||
            "-"
          )}
        </td>

        <td>
          ${formatDate(
            log.created_at ||
            log.date
          )}
        </td>

      </tr>

    `
    ).join("");
}


if ($("refreshLogs")) {

  $("refreshLogs")
    .addEventListener(
      "click",
      loadLogs
    );

}


/* =========================================================
   SESSION RESTORE
========================================================= */

async function restoreSession() {

  try {

    const saved =
      localStorage.getItem(
        "schoolUser"
      );


    if (saved) {

      currentUser =
        JSON.parse(saved);

      showApplication();

      return;
    }


    /* محاولة معرفة الجلسة من السيرفر */

    try {

      const data =
        await api(
          "/api/me"
        );


      if (data?.user) {

        currentUser =
          data.user;

        localStorage.setItem(
          "schoolUser",
          JSON.stringify(currentUser)
        );

        showApplication();

      }

    } catch {
      // لا توجد جلسة
    }


  } catch (error) {

    console.error(
      "Session restore error:",
      error
    );

  }

}


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    restoreSession();

  }
);


/* =========================================================
   AUTO REFRESH
========================================================= */

setInterval(
  () => {

    if (
      appPage &&
      !appPage.classList.contains("hidden")
    ) {

      loadDashboard();

    }

  },
  30000
);


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.toggleUser =
  toggleUser;

window.deleteUser =
  deleteUser;

window.editStudent =
  editStudent;

window.deleteStudent =
  deleteStudent;

window.editEmployee =
  editEmployee;

window.deleteEmployee =
  deleteEmployee;

window.markAttendance =
  markAttendance;

window.editPayroll =
  editPayroll;

window.deleteNote =
  deleteNote;

window.deleteVideo =
  deleteVideo;

window.closeModal =
  closeModal;


/* =========================================================
   SMALL STYLE FIX FOR TOAST
========================================================= */

(function addToastStyle() {

  if (document.getElementById("toastStyle")) {
    return;
  }


  const style =
    document.createElement("style");

  style.id = "toastStyle";

  style.textContent = `

    .toast {
      position: fixed;
      bottom: 25px;
      right: 25px;
      z-index: 9999;
      min-width: 220px;
      max-width: 400px;
      padding: 14px 18px;
      border-radius: 10px;
      background: #173b70;
      color: white;
      font-weight: bold;
      box-shadow: 0 10px 30px rgba(0,0,0,.2);
      opacity: 0;
      transform: translateY(20px);
      pointer-events: none;
      transition: .25s;
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    .toast-success {
      background: #16803c;
    }

    .toast-error {
      background: #c62828;
    }

    @media(max-width:650px) {
      .toast {
        right: 15px;
        left: 15px;
        bottom: 15px;
        min-width: auto;
      }
    }

  `;

  document.head.appendChild(style);

})();
