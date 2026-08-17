let me = null;
const app = document.getElementById("app");

/* =========================
   API
========================= */

async function api(url, opt = {}) {
  const options = {
    ...opt,
    headers: {
      "Content-Type": "application/json",
      ...(opt.headers || {})
    }
  };

  const r = await fetch(url, options);
  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(d.error || "حدث خطأ");
  }

  return d;
}

/* =========================
   LOGIN / LOGOUT
========================= */

function logout() {
  localStorage.removeItem("me");
  me = null;
  render();
}

function loginPage() {
  app.innerHTML = `
    <div class="login">
      <h1>🏫 بوابة مدرسة التعليم البريطاني</h1>

      <input id="u" placeholder="اسم المستخدم">

      <input
        id="p"
        type="password"
        placeholder="كلمة المرور"
      >

      <button onclick="login()">دخول</button>

      <div class="notice">
        للتجربة:
        <br>
        admin / 1234
        <br>
        teacher / 1234
        <br>
        parent / 1234
      </div>
    </div>
  `;
}

async function login() {
  try {
    me = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: u.value.trim(),
        password: p.value
      })
    });

    localStorage.setItem("me", JSON.stringify(me));

    render();

  } catch (e) {
    alert(e.message);
  }
}

/* =========================
   RENDER
========================= */

async function render() {

  if (!me) {
    loginPage();
    return;
  }

  try {

    if (me.role === "admin") {
      await admin();
      return;
    }

    if (me.role === "teacher") {
      await teacher();
      return;
    }

    await family();

  } catch (e) {

    console.error(e);

    app.innerHTML = `
      <div class="wrap">
        <div class="notice">
          حدث خطأ أثناء تحميل الصفحة:
          <br><br>
          ${e.message}
        </div>
      </div>
    `;
  }
}

/* =========================
   ADMIN
========================= */

async function admin() {

  const [students, users] = await Promise.all([
    api("/api/students"),
    api("/api/users")
  ]);

  const onlineUsers = users.filter(x => x.online).length;

  app.innerHTML = `
    <div class="wrap">

      <h1>لوحة الإدارة</h1>

      <!-- STATISTICS -->

      <div class="cards">

        <div class="card">
          الطلاب
          <div class="num">
            ${students.length}
          </div>
        </div>

        <div class="card">
          الحاضرون
          <div class="num">
            ${students.filter(x => x.status === "حاضر").length}
          </div>
        </div>

        <div class="card">
          الغائبون
          <div class="num">
            ${students.filter(x => x.status === "غائب").length}
          </div>
        </div>

        <div class="card">
          المتصلون الآن
          <div class="num">
            ${onlineUsers}
          </div>
        </div>

      </div>

      <!-- USERS -->

      <h2>👥 إدارة المستخدمين</h2>

      <div class="form">

        <h3>إضافة مستخدم جديد</h3>

        <div class="form row">

          <input
            id="newUsername"
            placeholder="اسم المستخدم"
          >

          <input
            id="newPassword"
            placeholder="كلمة المرور"
          >

          <input
            id="newName"
            placeholder="الاسم"
          >

          <select id="newRole">
            <option value="teacher">مدرس</option>
            <option value="parent">ولي أمر</option>
            <option value="student">طالب</option>
            <option value="admin">مدير</option>
          </select>

          <button onclick="addUser()">
            ➕ إضافة المستخدم
          </button>

        </div>

      </div>

      <div class="card">

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>اسم المستخدم</th>
            <th>الصلاحية</th>
            <th>الحالة</th>
            <th>آخر نشاط</th>
            <th>إجراء</th>
          </tr>

          ${
            users.map(user => `

              <tr>

                <td>
                  ${user.name}
                </td>

                <td>
                  ${user.username}
                </td>

                <td>
                  ${roleName(user.role)}
                </td>

                <td>
                  ${
                    user.active
                      ? (
                        user.online
                          ? `<span style="color:green;font-weight:bold">
                              🟢 متصل الآن
                            </span>`
                          : `<span style="color:#777">
                              ⚪ غير متصل
                            </span>`
                      )
                      : `<span style="color:red;font-weight:bold">
                          🔴 موقوف
                        </span>`
                  }
                </td>

                <td>
                  ${
                    user.last_seen
                      ? new Date(user.last_seen).toLocaleString("ar-EG")
                      : "لم يدخل بعد"
                  }
                </td>

                <td>

                  ${
                    user.username !== "admin"
                      ? `
                        ${
                          user.active
                            ? `
                              <button
                                onclick="disableUser(${user.id})"
                              >
                                ⛔ إيقاف
                              </button>
                            `
                            : `
                              <button
                                onclick="enableUser(${user.id})"
                              >
                                ✅ تفعيل
                              </button>
                            `
                        }

                        <button
                          onclick="deleteUser(${user.id}, '${escapeHtml(user.name)}')"
                        >
                          🗑️ حذف
                        </button>
                      `
                      : `
                        <b>المدير الرئيسي</b>
                      `
                  }

                </td>

              </tr>

            `).join("")
          }

        </table>

      </div>

      <!-- STUDENTS -->

      <h2>👨‍🎓 الطلاب</h2>

      <div class="card">

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>الفصل</th>
            <th>الحالة</th>
            <th>WhatsApp ولي الأمر</th>
          </tr>

          ${
            students.map(x => `

              <tr>

                <td>
                  ${x.name}
                </td>

                <td>
                  ${x.class_name}
                </td>

                <td>
                  ${
                    x.status === "حاضر"
                      ? "🟢 حاضر"
                      : "🔴 غائب"
                  }
                </td>

                <td>
                  ${x.parent_phone}
                </td>

              </tr>

            `).join("")
          }

        </table>

      </div>

      <!-- ADD STUDENT -->

      <h2>➕ إضافة طالب</h2>

      <div class="form">

        <div class="form row">

          <input
            id="sn"
            placeholder="اسم الطالب"
          >

          <input
            id="sc"
            placeholder="الفصل"
          >

          <input
            id="sp"
            placeholder="رقم WhatsApp ولي الأمر"
          >

          <button onclick="addStudent()">
            إضافة الطالب
          </button>

        </div>

      </div>

    </div>
  `;

  /* تحديث النشاط كل 20 ثانية */

  startActivity();
}

/* =========================
   ROLE NAME
========================= */

function roleName(role) {

  const roles = {
    admin: "مدير",
    teacher: "مدرس",
    parent: "ولي أمر",
    student: "طالب"
  };

  return roles[role] || role;
}

/* =========================
   ESCAPE HTML
========================= */

function escapeHtml(text) {

  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   ACTIVITY
========================= */

let activityTimer = null;

function startActivity() {

  if (activityTimer) {
    clearInterval(activityTimer);
  }

  if (!me || !me.id) {
    return;
  }

  activityTimer = setInterval(async () => {

    try {

      await api("/api/activity", {
        method: "POST",
        body: JSON.stringify({
          user_id: me.id
        })
      });

    } catch (e) {

      console.log("Activity error:", e.message);

      if (
        e.message.includes("موقوف") ||
        e.message.includes("الحساب")
      ) {

        logout();

        alert("تم إيقاف هذا الحساب من الإدارة.");
      }
    }

  }, 20000);
}

/* =========================
   ADD USER
========================= */

async function addUser() {

  try {

    const username =
      document.getElementById("newUsername").value.trim();

    const password =
      document.getElementById("newPassword").value.trim();

    const name =
      document.getElementById("newName").value.trim();

    const role =
      document.getElementById("newRole").value;

    if (!username || !password || !name) {

      alert("أكمل بيانات المستخدم");

      return;
    }

    await api("/api/users", {

      method: "POST",

      body: JSON.stringify({
        username,
        password,
        name,
        role
      })

    });

    alert("✅ تم إضافة المستخدم بنجاح");

    await admin();

  } catch (e) {

    alert(e.message);
  }
}

/* =========================
   DISABLE USER
========================= */

async function disableUser(id) {

  if (!confirm("هل تريد إيقاف هذا المستخدم؟")) {
    return;
  }

  try {

    await api(
      "/api/users/" + id + "/disable",
      {
        method: "PATCH"
      }
    );

    alert("⛔ تم إيقاف المستخدم");

    await admin();

  } catch (e) {

    alert(e.message);
  }
}

/* =========================
   ENABLE USER
========================= */

async function enableUser(id) {

  try {

    await api(
      "/api/users/" + id + "/enable",
      {
        method: "PATCH"
      }
    );

    alert("✅ تم تفعيل المستخدم");

    await admin();

  } catch (e) {

    alert(e.message);
  }
}

/* =========================
   DELETE USER
========================= */

async function deleteUser(id, name) {

  if (
    !confirm(
      "هل أنت متأكد من حذف المستخدم:\n" + name + " ؟"
    )
  ) {
    return;
  }

  try {

    await api(
      "/api/users/" + id,
      {
        method: "DELETE"
      }
    );

    alert("🗑️ تم حذف المستخدم");

    await admin();

  } catch (e) {

    alert(e.message);
  }
}

/* =========================
   ADD STUDENT
========================= */

async function addStudent() {

  try {

    const name =
      document.getElementById("sn").value.trim();

    const className =
      document.getElementById("sc").value.trim();

    const phone =
      document.getElementById("sp").value.trim();

    if (!name || !className || !phone) {

      alert("أكمل بيانات الطالب");

      return;
    }

    await api("/api/students", {

      method: "POST",

      body: JSON.stringify({
        name,
        class_name: className,
        parent_phone: phone
      })

    });

    alert("✅ تم إضافة الطالب");

    await admin();

  } catch (e) {

    alert(e.message);
  }
}

/* =========================
   TEACHER
========================= */

async function teacher() {

  const s = await api("/api/students");

  app.innerHTML = `

    <div class="wrap">

      <h1>👨‍🏫 بوابة المدرس</h1>

      <div class="card">

        <h2>الحضور والغياب</h2>

        <table class="table">

          <tr>
            <th>الطالب</th>
            <th>الفصل</th>
            <th>الحالة</th>
            <th>الإجراء</th>
          </tr>

          ${
            s.map(x => `

              <tr>

                <td>${x.name}</td>

                <td>${x.class_name}</td>

                <td>
                  ${
                    x.status === "حاضر"
                      ? "🟢 حاضر"
                      : "🔴 غائب"
                  }
                </td>

                <td>

                  <button
                    onclick="toggleStatus(${x.id})"
                  >
                    تغيير الحالة
                  </button>

                </td>

              </tr>

            `).join("")
          }

        </table>

      </div>

      <div class="form">

        <h2>📝 ملاحظة لولي الأمر</h2>

        <select id="sid">

          ${
            s.map(x => `
              <option value="${x.id}">
                ${x.name}
              </option>
            `).join("")
          }

        </select>

        <textarea
          id="nt"
          placeholder="اكتب الملاحظة اليومية"
        ></textarea>

        <button onclick="note()">
          حفظ الملاحظة
        </button>

        <div class="msg">
          سيتم ربط الإرسال الفعلي عبر WhatsApp
          بعد إضافة WhatsApp Business API.
        </div>

      </div>

      <div class="form">

        <h2>🎥 فيديو الحصة</h2>

        <input
          id="vt"
          placeholder="اسم المادة والحصة"
        >

        <input
          id="vf"
          type="file"
          accept="video/*"
        >

        <button onclick="video()">
          حفظ بيانات الفيديو
        </button>

      </div>

    </div>
  `;
}

/* =========================
   TOGGLE STATUS
========================= */

async function toggleStatus(id) {

  try {

    await api(
      "/api/students/" + id + "/status",
      {
        method: "PATCH"
      }
    );

    await teacher();

  } catch (e) {

    alert(e.message);
  }
}

/* =========================
   NOTES
========================= */

async function note() {

  try {

    const studentId =
      Number(document.getElementById("sid").value);

    const text =
      document.getElementById("nt").value.trim();

    if (!text) {

      alert("اكتب الملاحظة");

      return;
    }

    await api("/api/notes", {

      method: "POST",

      body: JSON.stringify({
        student_id: studentId,
        text
      })

    });

    alert(
      "✅ تم حفظ الملاحظة وتجهيزها للربط مع WhatsApp"
    );

    await teacher();

  } catch (e) {

    alert(e.message);
  }
}

/* =========================
   VIDEO
========================= */

async function video() {

  try {

    const title =
      document.getElementById("vt").value.trim();

    const file =
      document.getElementById("vf").files[0];

    if (!title) {

      alert("اكتب اسم الحصة");

      return;
    }

    await api("/api/videos", {

      method: "POST",

      body: JSON.stringify({
        title,
        file_name: file ? file.name : ""
      })

    });

    alert(
      "✅ تم حفظ بيانات الحصة"
    );

  } catch (e) {

    alert(e.message);
  }
}

/* =========================
   FAMILY / PARENT
========================= */

async function family() {

  const students =
    await api("/api/students");

  if (!students.length) {

    app.innerHTML = `
      <div class="wrap">
        <div class="card">
          لا يوجد طالب مرتبط بهذا الحساب حالياً.
        </div>
      </div>
    `;

    return;
  }

  const s = students[0];

  const n =
    await api("/api/notes/" + s.id);

  const v =
    await api("/api/videos");

  app.innerHTML = `

    <div class="wrap">

      <h1>👨‍👩‍👦 بوابة ولي الأمر</h1>

      <div class="cards">

        <div class="card">

          الطالب

          <div class="num">
            ${s.name}
          </div>

          <p>
            ${s.class_name}
          </p>

        </div>

        <div class="card">

          الحضور اليوم

          <div class="num">
            ${s.status}
          </div>

        </div>

      </div>

      <h2>📝 ملاحظات المدرسة</h2>

      ${
        n.map(x => `

          <div class="notice">

            <b>
              ${x.created_at}
            </b>

            <br>

            ${x.text}

            <br>

            <small>
              📱 جاهزة للإرسال عبر WhatsApp بعد الربط
            </small>

          </div>

        `).join("")

        ||

        `
          <div class="card">
            لا توجد ملاحظات.
          </div>
        `
      }

      <h2>🎥 الحصص</h2>

      ${
        v.map(x => `

          <div class="card">

            🎥 ${x.title}

            <br>

            <small>
              ${x.created_at}
            </small>

          </div>

        `).join("")

        ||

        `
          <div class="card">
            لا توجد حصص.
          </div>
        `
      }

    </div>
  `;
}

/* =========================
   START
========================= */

try {

  me = JSON.parse(
    localStorage.getItem("me") || "null"
  );

} catch (e) {

  me = null;
  localStorage.removeItem("me");
}

render();
