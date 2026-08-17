"use strict";

/* =====================================================
   ELEMENTS
===================================================== */

const loginPage = document.getElementById("loginPage");
const appPage = document.getElementById("appPage");

const loginBox = document.getElementById("loginBox");
const registerBox = document.getElementById("registerBox");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");

const showRegisterButton =
  document.getElementById("showRegisterButton");

const backToLoginButton =
  document.getElementById("backToLoginButton");

const logoutButton =
  document.getElementById("logoutButton");

const currentUserName =
  document.getElementById("currentUserName");

const modal =
  document.getElementById("modal");

const modalTitle =
  document.getElementById("modalTitle");

const modalBody =
  document.getElementById("modalBody");

const modalClose =
  document.getElementById("modalClose");

const toast =
  document.getElementById("toast");

/* =====================================================
   CURRENT USER
===================================================== */

let currentUser = null;

/* =====================================================
   API HELPER
===================================================== */

async function api(url, options = {}) {

  try {

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        error: text || `HTTP ${response.status}`
      };
    }

    if (!response.ok) {

      throw new Error(
        data.error ||
        `خطأ HTTP ${response.status}`
      );
    }

    return data;

  } catch (error) {

    console.error(
      "API ERROR:",
      url,
      error
    );

    throw error;
  }
}

/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

  if (!toast) return;

  toast.textContent = message;

  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

/* =====================================================
   MODAL
===================================================== */

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

modalClose?.addEventListener(
  "click",
  closeModal
);

document
  .querySelector(".modal-overlay")
  ?.addEventListener(
    "click",
    closeModal
  );

/* =====================================================
   REGISTER PAGE
===================================================== */

showRegisterButton?.addEventListener(
  "click",
  () => {

    loginBox.classList.add("hidden");

    registerBox.classList.remove("hidden");

    loginMessage.textContent = "";
    registerMessage.textContent = "";
  }
);

backToLoginButton?.addEventListener(
  "click",
  () => {

    registerBox.classList.add("hidden");

    loginBox.classList.remove("hidden");

    loginMessage.textContent = "";
    registerMessage.textContent = "";
  }
);

/* =====================================================
   REGISTER
===================================================== */

registerForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const name =
      document
        .getElementById("registerName")
        .value
        .trim();

    const username =
      document
        .getElementById("registerUsername")
        .value
        .trim();

    const password =
      document
        .getElementById("registerPassword")
        .value;

    const confirmPassword =
      document
        .getElementById(
          "registerPasswordConfirm"
        )
        .value;

    if (!name || !username || !password) {

      registerMessage.textContent =
        "أكمل جميع البيانات";

      return;
    }

    if (password.length < 4) {

      registerMessage.textContent =
        "كلمة المرور يجب أن تكون 4 أحرف على الأقل";

      return;
    }

    if (password !== confirmPassword) {

      registerMessage.textContent =
        "كلمتا المرور غير متطابقتين";

      return;
    }

    registerMessage.textContent =
      "جاري إنشاء الحساب...";

    try {

      await api(
        "/api/users",
        {
          method: "POST",

          body: JSON.stringify({
            username,
            password,
            name,
            role: "user"
          })
        }
      );

      registerMessage.textContent =
        "تم إنشاء الحساب بنجاح ✅";

      registerForm.reset();

      setTimeout(() => {

        registerBox.classList.add("hidden");

        loginBox.classList.remove("hidden");

        document
          .getElementById("username")
          .value = username;

        document
          .getElementById("password")
          .value = "";

        registerMessage.textContent = "";

      }, 1000);

    } catch (error) {

      registerMessage.textContent =
        error.message ||
        "تعذر إنشاء الحساب";
    }
  }
);

/* =====================================================
   LOGIN
===================================================== */

loginForm?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const username =
      document
        .getElementById("username")
        .value
        .trim();

    const password =
      document
        .getElementById("password")
        .value;

    if (!username || !password) {

      loginMessage.textContent =
        "أدخل اسم المستخدم وكلمة المرور";

      return;
    }

    loginMessage.textContent =
      "جاري تسجيل الدخول...";

    try {

      const data =
        await api(
          "/api/login",
          {
            method: "POST",

            body: JSON.stringify({
              username,
              password
            })
          }
        );

      if (!data.success || !data.user) {

        loginMessage.textContent =
          data.error ||
          "فشل تسجيل الدخول";

        return;
      }

      currentUser = data.user;

      localStorage.setItem(
        "schoolUser",
        JSON.stringify(currentUser)
      );

      showApplication();

      loginMessage.textContent = "";

      await loadDashboard();

      showToast(
        `مرحباً ${currentUser.name} 👋`
      );

    } catch (error) {

      console.error(
        "LOGIN ERROR:",
        error
      );

      loginMessage.textContent =
        error.message ||
        "تعذر الاتصال بالسيرفر";
    }
  }
);

/* =====================================================
   SHOW APPLICATION
===================================================== */

function showApplication() {

  loginPage.classList.add("hidden");

  appPage.classList.remove("hidden");

  if (currentUserName) {

    currentUserName.textContent =
      currentUser.name;
  }
}

/* =====================================================
   LOGOUT
===================================================== */

logoutButton?.addEventListener(
  "click",
  async () => {

    try {

      if (currentUser) {

        await api(
          "/api/logout",
          {
            method: "POST",

            body: JSON.stringify({
              userId: currentUser.id
            })
          }
        );
      }

    } catch (error) {

      console.error(error);

    } finally {

      currentUser = null;

      localStorage.removeItem(
        "schoolUser"
      );

      appPage.classList.add("hidden");

      loginPage.classList.remove("hidden");

      loginBox.classList.remove("hidden");

      registerBox.classList.add("hidden");

      loginForm?.reset();

      showToast(
        "تم تسجيل الخروج"
      );
    }
  }
);

/* =====================================================
   NAVIGATION
===================================================== */

const navItems =
  document.querySelectorAll(
    ".nav-item"
  );

const pageSections =
  document.querySelectorAll(
    ".page-section"
  );

navItems.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      const page =
        button.dataset.page;

      navItems.forEach(item => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      pageSections.forEach(section => {
        section.classList.add("hidden");
      });

      const target =
        document.getElementById(
          `page-${page}`
        );

      target?.classList.remove("hidden");

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
        loadNoteStudents();
      }

      if (page === "videos") {
        loadVideos();
      }

      if (page === "logs") {
        loadLogs();
      }
    }
  );
});

/* =====================================================
   DASHBOARD
===================================================== */

async function loadDashboard() {

  try {

    const data =
      await api(
        "/api/dashboard"
      );

    document.getElementById(
      "statUsers"
    ).textContent =
      data.stats.users;

    document.getElementById(
      "statOnline"
    ).textContent =
      data.stats.online;

    document.getElementById(
      "statStudents"
    ).textContent =
      data.stats.students;

    document.getElementById(
      "statEmployees"
    ).textContent =
      data.stats.employees;

    document.getElementById(
      "healthStatus"
    ).innerHTML =
      `
      <div>
        🟢 النظام يعمل بشكل طبيعي
      </div>
      `;

    const list =
      document.getElementById(
        "onlineUsersList"
      );

    if (
      !data.onlineUsers ||
      data.onlineUsers.length === 0
    ) {

      list.textContent =
        "لا يوجد مستخدمون متصلون الآن";

      return;
    }

    list.innerHTML =
      data.onlineUsers
        .map(user => `
          <div style="
            padding:10px;
            border-bottom:1px solid #eee;
          ">
            🟢
            <strong>
              ${escapeHtml(user.name)}
            </strong>
            <small>
              (${escapeHtml(user.username)})
            </small>
          </div>
        `)
        .join("");

  } catch (error) {

    document.getElementById(
      "healthStatus"
    ).textContent =
      error.message;
  }
}

document
  .getElementById("refreshDashboard")
  ?.addEventListener(
    "click",
    loadDashboard
  );

/* =====================================================
   USERS
===================================================== */

async function loadUsers() {

  try {

    const data =
      await api(
        "/api/users"
      );

    const users =
      data.users || [];

    document.getElementById(
      "usersTotal"
    ).textContent =
      users.length;

    document.getElementById(
      "usersActive"
    ).textContent =
      users.filter(
        user => user.active
      ).length;

    document.getElementById(
      "usersOnline"
    ).textContent =
      users.filter(
        user =>
          user.online &&
          user.active
      ).length;

    const body =
      document.getElementById(
        "usersTableBody"
      );

    body.innerHTML =
      users.map((user, index) => {

        const status =
          user.active
            ? "نشط"
            : "موقوف";

        const online =
          user.online
            ? "🟢 متصل"
            : "⚪ غير متصل";

        return `
          <tr>

            <td>${index + 1}</td>

            <td>
              ${escapeHtml(
                user.username
              )}
            </td>

            <td>
              ${escapeHtml(
                user.name
              )}
            </td>

            <td>
              ${
                user.role === "admin"
                  ? "مدير"
                  : "مستخدم"
              }
            </td>

            <td>
              ${status}
              <br>
              <small>${online}</small>
            </td>

            <td>
              ${
                user.last_seen
                  ? formatDate(
                      user.last_seen
                    )
                  : "-"
              }
            </td>

            <td>

              ${
                user.username !== "admin"
                  ? `
                    <button
                      class="btn btn-secondary"
                      onclick="toggleUser(${user.id}, ${user.active ? 0 : 1})"
                    >
                      ${
                        user.active
                          ? "إيقاف"
                          : "تفعيل"
                      }
                    </button>

                    <button
                      class="btn btn-danger"
                      onclick="deleteUser(${user.id})"
                    >
                      حذف
                    </button>
                  `
                  : "المدير الرئيسي"
              }

            </td>

          </tr>
        `;

      }).join("");

  } catch (error) {

    showToast(
      error.message
    );
  }
}

/* =====================================================
   ADD USER
===================================================== */

document
  .getElementById("addUserButton")
  ?.addEventListener(
    "click",
    () => {

      openModal(
        "إضافة مستخدم",
        `
        <form id="modalUserForm">

          <div class="form-group">
            <label>الاسم</label>
            <input id="mUserName" required>
          </div>

          <div class="form-group">
            <label>اسم المستخدم</label>
            <input id="mUsername" required>
          </div>

          <div class="form-group">
            <label>كلمة المرور</label>
            <input
              id="mPassword"
              type="password"
              minlength="4"
              required
            >
          </div>

          <div class="form-group">
            <label>الصلاحية</label>

            <select id="mRole">
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
            حفظ
          </button>

        </form>
        `
      );

      document
        .getElementById(
          "modalUserForm"
        )
        .addEventListener(
          "submit",
          async event => {

            event.preventDefault();

            try {

              await api(
                "/api/users",
                {
                  method: "POST",

                  body:
                    JSON.stringify({
                      name:
                        document
                          .getElementById(
                            "mUserName"
                          )
                          .value
                          .trim(),

                      username:
                        document
                          .getElementById(
                            "mUsername"
                          )
                          .value
                          .trim(),

                      password:
                        document
                          .getElementById(
                            "mPassword"
                          )
                          .value,

                      role:
                        document
                          .getElementById(
                            "mRole"
                          )
                          .value
                    })
                }
              );

              closeModal();

              showToast(
                "تمت إضافة المستخدم"
              );

              loadUsers();

            } catch (error) {

              showToast(
                error.message
              );
            }
          }
        );
    }
  );

async function toggleUser(
  id,
  active
) {

  try {

    await api(
      `/api/users/${id}/status`,
      {
        method: "PATCH",

        body:
          JSON.stringify({
            active: Boolean(active)
          })
      }
    );

    showToast(
      "تم تحديث حالة المستخدم"
    );

    loadUsers();

  } catch (error) {

    showToast(
      error.message
    );
  }
}

async function deleteUser(id) {

  if (
    !confirm(
      "هل أنت متأكد من حذف المستخدم؟"
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
      error.message
    );
  }
}

/* =====================================================
   STUDENTS
===================================================== */

async function loadStudents() {

  try {

    const data =
      await api(
        "/api/students"
      );

    const students =
      data.students || [];

    const body =
      document.getElementById(
        "studentsTableBody"
      );

    body.innerHTML =
      students.map(
        (student, index) => `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>
              ${escapeHtml(
                student.name
              )}
            </td>

            <td>
              ${escapeHtml(
                student.class_name ||
                "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                student.parent_phone ||
                "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                student.status
              )}
            </td>

            <td>

              <button
                class="btn btn-danger"
                onclick="deleteStudent(${student.id})"
              >
                حذف
              </button>

            </td>

          </tr>
        `
      ).join("");

  } catch (error) {

    showToast(
      error.message
    );
  }
}

/* =====================================================
   ADD STUDENT
===================================================== */

document
  .getElementById("addStudentButton")
  ?.addEventListener(
    "click",
    () => {

      openModal(
        "إضافة طالب",
        `
        <form id="studentForm">

          <div class="form-group">
            <label>اسم الطالب</label>
            <input id="sName" required>
          </div>

          <div class="form-group">
            <label>الفصل</label>
            <input id="sClass">
          </div>

          <div class="form-group">
            <label>هاتف ولي الأمر</label>
            <input id="sPhone">
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

      document
        .getElementById(
          "studentForm"
        )
        .addEventListener(
          "submit",
          async event => {

            event.preventDefault();

            try {

              await api(
                "/api/students",
                {
                  method: "POST",

                  body:
                    JSON.stringify({
                      name:
                        document
                          .getElementById(
                            "sName"
                          )
                          .value
                          .trim(),

                      class_name:
                        document
                          .getElementById(
                            "sClass"
                          )
                          .value
                          .trim(),

                      parent_phone:
                        document
                          .getElementById(
                            "sPhone"
                          )
                          .value
                          .trim()
                    })
                }
              );

              closeModal();

              showToast(
                "تمت إضافة الطالب"
              );

              loadStudents();

            } catch (error) {

              showToast(
                error.message
              );
            }
          }
        );
    }
  );

async function deleteStudent(id) {

  if (
    !confirm(
      "هل تريد حذف الطالب؟"
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
      error.message
    );
  }
}

/* =====================================================
   EMPLOYEES
===================================================== */

async function loadEmployees() {

  try {

    const data =
      await api(
        "/api/employees"
      );

    const employees =
      data.employees || [];

    const body =
      document.getElementById(
        "employeesTableBody"
      );

    body.innerHTML =
      employees.map(
        (employee, index) => `
          <tr>

            <td>${index + 1}</td>

            <td>
              ${escapeHtml(
                employee.employee_no ||
                "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                employee.name
              )}
            </td>

            <td>
              ${escapeHtml(
                employee.job ||
                "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                employee.department ||
                "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                employee.phone ||
                "-"
              )}
            </td>

            <td>
              ${Number(
                employee.salary || 0
              ).toLocaleString()}
            </td>

            <td>
              ${escapeHtml(
                employee.status
              )}
            </td>

            <td>

              <button
                class="btn btn-danger"
                onclick="deleteEmployee(${employee.id})"
              >
                حذف
              </button>

            </td>

          </tr>
        `
      ).join("");

  } catch (error) {

    showToast(
      error.message
    );
  }
}

/* =====================================================
   ADD EMPLOYEE
===================================================== */

document
  .getElementById(
    "addEmployeeButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openModal(
        "إضافة موظف",
        `
        <form id="employeeForm">

          <div class="form-group">
            <label>رقم الموظف</label>
            <input id="eNo">
          </div>

          <div class="form-group">
            <label>الاسم</label>
            <input id="eName" required>
          </div>

          <div class="form-group">
            <label>الوظيفة</label>
            <input id="eJob">
          </div>

          <div class="form-group">
            <label>القسم</label>
            <input id="eDepartment">
          </div>

          <div class="form-group">
            <label>الهاتف</label>
            <input id="ePhone">
          </div>

          <div class="form-group">
            <label>الراتب</label>
            <input
              id="eSalary"
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

      document
        .getElementById(
          "employeeForm"
        )
        .addEventListener(
          "submit",
          async event => {

            event.preventDefault();

            try {

              await api(
                "/api/employees",
                {
                  method: "POST",

                  body:
                    JSON.stringify({
                      employee_no:
                        document
                          .getElementById(
                            "eNo"
                          )
                          .value,

                      name:
                        document
                          .getElementById(
                            "eName"
                          )
                          .value
                          .trim(),

                      job:
                        document
                          .getElementById(
                            "eJob"
                          )
                          .value,

                      department:
                        document
                          .getElementById(
                            "eDepartment"
                          )
                          .value,

                      phone:
                        document
                          .getElementById(
                            "ePhone"
                          )
                          .value,

                      salary:
                        Number(
                          document
                            .getElementById(
                              "eSalary"
                            )
                            .value
                        )
                    })
                }
              );

              closeModal();

              showToast(
                "تمت إضافة الموظف"
              );

              loadEmployees();

            } catch (error) {

              showToast(
                error.message
              );
            }
          }
        );
    }
  );

async function deleteEmployee(id) {

  if (
    !confirm(
      "هل تريد حذف الموظف؟"
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
      error.message
    );
  }
}

/* =====================================================
   ATTENDANCE
===================================================== */

async function loadAttendance() {

  try {

    const studentsData =
      await api(
        "/api/attendance/students"
      );

    const studentBody =
      document.getElementById(
        "attendanceStudentsBody"
      );

    studentBody.innerHTML =
      (studentsData.students || [])
        .map(
          student => `
            <tr>

              <td>
                ${escapeHtml(
                  student.name
                )}
              </td>

              <td>
                ${escapeHtml(
                  student.class_name ||
                  "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  student.attendance_status
                )}
              </td>

              <td>

                <select
                  onchange="
                    saveStudentAttendance(
                      ${student.id},
                      this.value
                    )
                  "
                >

                  <option value="">
                    اختر
                  </option>

                  <option value="حاضر">
                    حاضر
                  </option>

                  <option value="غائب">
                    غائب
                  </option>

                  <option value="متأخر">
                    متأخر
                  </option>

                </select>

              </td>

            </tr>
          `
        )
        .join("");

    const employeeData =
      await api(
        "/api/attendance/employees"
      );

    const employeeBody =
      document.getElementById(
        "attendanceEmployeesBody"
      );

    employeeBody.innerHTML =
      (employeeData.attendance || [])
        .map(
          row => `
            <tr>

              <td>
                ${escapeHtml(
                  row.name ||
                  "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  row.date ||
                  "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  row.check_in ||
                  "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  row.check_out ||
                  "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  row.status ||
                  "-"
                )}
              </td>

              <td>
                ${Number(
                  row.late_minutes || 0
                )}
              </td>

            </tr>
          `
        )
        .join("");

  } catch (error) {

    showToast(
      error.message
    );
  }
}

async function saveStudentAttendance(
  studentId,
  status
) {

  if (!status) return;

  try {

    await api(
      "/api/attendance/students",
      {
        method: "POST",

        body:
          JSON.stringify({
            student_id: studentId,
            status
          })
      }
    );

    showToast(
      "تم تسجيل الحضور"
    );

    loadAttendance();

  } catch (error) {

    showToast(
      error.message
    );
  }
}

document
  .getElementById(
    "refreshStudentAttendance"
  )
  ?.addEventListener(
    "click",
    loadAttendance
  );

/* =====================================================
   PAYROLL
===================================================== */

async function loadPayroll() {

  try {

    const data =
      await api(
        "/api/payroll"
      );

    const body =
      document.getElementById(
        "payrollTableBody"
      );

    body.innerHTML =
      (data.payroll || [])
        .map(
          row => `
            <tr>

              <td>
                ${escapeHtml(
                  row.name
                )}
              </td>

              <td>
                ${Number(
                  row.basic
                ).toLocaleString()}
              </td>

              <td>
                ${Number(
                  row.allowances
                ).toLocaleString()}
              </td>

              <td>
                ${Number(
                  row.bonuses
                ).toLocaleString()}
              </td>

              <td>
                ${Number(
                  row.deductions
                ).toLocaleString()}
              </td>

              <td>
                <strong>
                  ${Number(
                    row.net
                  ).toLocaleString()}
                </strong>
              </td>

              <td>

                <button
                  class="btn btn-secondary"
                  onclick="
                    editPayroll(
                      ${row.employee_id},
                      '${escapeAttr(row.name)}',
                      ${row.basic},
                      ${row.allowances},
                      ${row.bonuses},
                      ${row.deductions}
                    )
                  "
                >
                  تعديل
                </button>

              </td>

            </tr>
          `
        )
        .join("");

  } catch (error) {

    showToast(
      error.message
    );
  }
}

function editPayroll(
  employeeId,
  name,
  basic,
  allowances,
  bonuses,
  deductions
) {

  openModal(
    `راتب ${name}`,
    `
      <form id="payrollForm">

        <div class="form-group">
          <label>الأساسي</label>
          <input
            id="pBasic"
            type="number"
            value="${basic}"
          >
        </div>

        <div class="form-group">
          <label>البدلات</label>
          <input
            id="pAllowances"
            type="number"
            value="${allowances}"
          >
        </div>

        <div class="form-group">
          <label>المكافآت</label>
          <input
            id="pBonuses"
            type="number"
            value="${bonuses}"
          >
        </div>

        <div class="form-group">
          <label>الخصومات</label>
          <input
            id="pDeductions"
            type="number"
            value="${deductions}"
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

  document
    .getElementById(
      "payrollForm"
    )
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await api(
            "/api/payroll",
            {
              method: "POST",

              body:
                JSON.stringify({
                  employee_id:
                    employeeId,

                  basic:
                    Number(
                      document
                        .getElementById(
                          "pBasic"
                        )
                        .value
                    ),

                  allowances:
                    Number(
                      document
                        .getElementById(
                          "pAllowances"
                        )
                        .value
                    ),

                  bonuses:
                    Number(
                      document
                        .getElementById(
                          "pBonuses"
                        )
                        .value
                    ),

                  deductions:
                    Number(
                      document
                        .getElementById(
                          "pDeductions"
                        )
                        .value
                    )
                })
            }
          );

          closeModal();

          showToast(
            "تم حفظ الراتب"
          );

          loadPayroll();

        } catch (error) {

          showToast(
            error.message
          );
        }
      }
    );
}

/* =====================================================
   NOTES
===================================================== */

async function loadNoteStudents() {

  try {

    const data =
      await api(
        "/api/students"
      );

    const select =
      document.getElementById(
        "noteStudent"
      );

    select.innerHTML =
      `
        <option value="">
          اختر الطالب
        </option>
      `;

    (data.students || [])
      .forEach(student => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          student.id;

        option.textContent =
          student.name;

        select.appendChild(
          option
        );
      });

  } catch (error) {

    showToast(
      error.message
    );
  }
}

async function loadNotes() {

  try {

    const data =
      await api(
        "/api/notes"
      );

    const body =
      document.getElementById(
        "notesTableBody"
      );

    body.innerHTML =
      (data.notes || [])
        .map(
          note => `
            <tr>

              <td>
                ${escapeHtml(
                  note.student_name ||
                  "-"
                )}
              </td>

              <td>
                ${escapeHtml(
                  note.note
                )}
              </td>

              <td>
                ${formatDate(
                  note.created_at
                )}
              </td>

              <td>

                <button
                  class="btn btn-danger"
                  onclick="
                    deleteNote(
                      ${note.id}
                    )
                  "
                >
                  حذف
                </button>

              </td>

            </tr>
          `
        )
        .join("");

  } catch (error) {

    showToast(
      error.message
    );
  }
}

document
  .getElementById(
    "saveNoteButton"
  )
  ?.addEventListener(
    "click",
    async () => {

      const studentId =
        document
          .getElementById(
            "noteStudent"
          )
          .value;

      const note =
        document
          .getElementById(
            "noteText"
          )
          .value
          .trim();

      if (!studentId || !note) {

        showToast(
          "اختر الطالب واكتب الملاحظة"
        );

        return;
      }

      try {

        await api(
          "/api/notes",
          {
            method: "POST",

            body:
              JSON.stringify({
                student_id:
                  Number(studentId),

                note
              })
          }
        );

        document
          .getElementById(
            "noteText"
          )
          .value = "";

        showToast(
          "تم حفظ الملاحظة"
        );

        loadNotes();

      } catch (error) {

        showToast(
          error.message
        );
      }
    }
  );

async function deleteNote(id) {

  if (
    !confirm(
      "هل تريد حذف الملاحظة؟"
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

    loadNotes();

    showToast(
      "تم حذف الملاحظة"
    );

  } catch (error) {

    showToast(
      error.message
    );
  }
}

/* =====================================================
   VIDEOS
===================================================== */

async function loadVideos() {

  try {

    const data =
      await api(
        "/api/videos"
      );

    const grid =
      document.getElementById(
        "videosGrid"
      );

    grid.innerHTML =
      (data.videos || [])
        .map(
          video => `
            <div class="card">

              <h3>
                ${escapeHtml(
                  video.title
                )}
              </h3>

              <p>
                ${escapeHtml(
                  video.subject ||
                  ""
                )}
              </p>

              <p>
                ${escapeHtml(
                  video.description ||
                  ""
                )}
              </p>

              ${
                video.url
                  ? `
                    <a
                      href="${escapeAttr(video.url)}"
                      target="_blank"
                      rel="noopener"
                      class="btn btn-primary"
                    >
                      ▶ فتح الحصة
                    </a>
                  `
                  : ""
              }

              <button
                class="btn btn-danger"
                onclick="
                  deleteVideo(
                    ${video.id}
                  )
                "
              >
                حذف
              </button>

            </div>
          `
        )
        .join("");

  } catch (error) {

    showToast(
      error.message
    );
  }
}

/* =====================================================
   ADD VIDEO
===================================================== */

document
  .getElementById(
    "addVideoButton"
  )
  ?.addEventListener(
    "click",
    () => {

      openModal(
        "إضافة حصة",
        `
        <form id="videoForm">

          <div class="form-group">
            <label>عنوان الحصة</label>
            <input
              id="vTitle"
              required
            >
          </div>

          <div class="form-group">
            <label>المادة</label>
            <input id="vSubject">
          </div>

          <div class="form-group">
            <label>رابط الفيديو</label>
            <input
              id="vUrl"
              type="url"
              placeholder="https://..."
            >
          </div>

          <div class="form-group">
            <label>الوصف</label>
            <textarea
              id="vDescription"
            ></textarea>
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

      document
        .getElementById(
          "videoForm"
        )
        .addEventListener(
          "submit",
          async event => {

            event.preventDefault();

            try {

              await api(
                "/api/videos",
                {
                  method: "POST",

                  body:
                    JSON.stringify({
                      title:
                        document
                          .getElementById(
                            "vTitle"
                          )
                          .value
                          .trim(),

                      subject:
                        document
                          .getElementById(
                            "vSubject"
                          )
                          .value
                          .trim(),

                      url:
                        document
                          .getElementById(
                            "vUrl"
                          )
                          .value
                          .trim(),

                      description:
                        document
                          .getElementById(
                            "vDescription"
                          )
                          .value
                          .trim()
                    })
                }
              );

              closeModal();

              showToast(
                "تمت إضافة الحصة"
              );

              loadVideos();

            } catch (error) {

              showToast(
                error.message
              );
            }
          }
        );
    }
  );

async function deleteVideo(id) {

  if (
    !confirm(
      "هل تريد حذف الحصة؟"
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
      error.message
    );
  }
}

/* =====================================================
   LOGS
===================================================== */

async function loadLogs() {

  try {

    const data =
      await api(
        "/api/logs"
      );

    const body =
      document.getElementById(
        "logsTableBody"
      );

    body.innerHTML =
      (data.logs || [])
        .map(
          (log, index) => `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHtml(
                  log.username
                )}
              </td>

              <td>
                ${escapeHtml(
                  log.action
                )}
              </td>

              <td>
                ${escapeHtml(
                  log.details ||
                  "-"
                )}
              </td>

              <td>
                ${formatDate(
                  log.created_at
                )}
              </td>

            </tr>
          `
        )
        .join("");

  } catch (error) {

    showToast(
      error.message
    );
  }
}

document
  .getElementById(
    "refreshLogs"
  )
  ?.addEventListener(
    "click",
    loadLogs
  );

/* =====================================================
   PAYROLL SETTINGS
===================================================== */

document
  .getElementById(
    "payrollSettingsButton"
  )
  ?.addEventListener(
    "click",
    () => {

      showToast(
        "إعدادات الرواتب جاهزة للتطوير"
      );
    }
  );

/* =====================================================
   MENU
===================================================== */

document
  .getElementById(
    "menuButton"
  )
  ?.addEventListener(
    "click",
    () => {

      const sidebar =
        document.getElementById(
          "sidebar"
        );

      if (!sidebar) return;

      sidebar.classList.toggle(
        "hidden"
      );
    }
  );

/* =====================================================
   SECURITY HELPERS
===================================================== */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function escapeAttr(value) {

  return escapeHtml(value);
}

/* =====================================================
   DATE
===================================================== */

function formatDate(value) {

  if (!value) {
    return "-";
  }

  try {

    return new Date(value)
      .toLocaleString(
        "ar-EG"
      );

  } catch {

    return value;
  }
}

/* =====================================================
   AUTO LOGIN
===================================================== */

async function restoreSession() {

  const saved =
    localStorage.getItem(
      "schoolUser"
    );

  if (!saved) {
    return;
  }

  try {

    currentUser =
      JSON.parse(saved);

    if (
      !currentUser ||
      !currentUser.id
    ) {
      throw new Error(
        "Invalid session"
      );
    }

    showApplication();

    await loadDashboard();

  } catch (error) {

    console.error(
      "SESSION ERROR:",
      error
    );

    localStorage.removeItem(
      "schoolUser"
    );

    currentUser = null;
  }
}

/* =====================================================
   START
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    restoreSession();

  }
);

/* =====================================================
   EXPOSE FUNCTIONS
===================================================== */

window.toggleUser =
  toggleUser;

window.deleteUser =
  deleteUser;

window.deleteStudent =
  deleteStudent;

window.deleteEmployee =
  deleteEmployee;

window.saveStudentAttendance =
  saveStudentAttendance;

window.deleteNote =
  deleteNote;

window.deleteVideo =
  deleteVideo;

window.editPayroll =
  editPayroll;
