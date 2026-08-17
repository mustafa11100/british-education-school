let me = null;

const app = document.getElementById("app");

async function api(url, options = {}) {
const response = await fetch(url, {
...options,
headers: {
"Content-Type": "application/json",
...(options.headers || {})
}
});

const data = await response.json().catch(() => ({}));

if (!response.ok) {
throw new Error(data.error || "حدث خطأ");
}

return data;
}

function esc(value) {
return String(value ?? "")
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function roleName(role) {
const names = {
admin: "مدير",
teacher: "مدرس",
parent: "ولي أمر",
student: "طالب"
};

return names[role] || role;
}

function formatDate(value) {
if (!value) return "لم يدخل بعد";

const date = new Date(value);

if (Number.isNaN(date.getTime())) {
return value;
}

return date.toLocaleString("ar-EG");
}

function logout() {
localStorage.removeItem("me");
me = null;
loginPage();
}

/* =========================
LOGIN
========================= */

function loginPage() {
app.innerHTML = ` <div class="login">

```
  <h1>🏫 بوابة مدرسة التعليم البريطاني</h1>

  <input
    id="loginUsername"
    placeholder="اسم المستخدم"
  >

  <input
    id="loginPassword"
    type="password"
    placeholder="كلمة المرور"
  >

  <button onclick="login()">
    دخول
  </button>

  <div class="notice">
    <b>حسابات التجربة:</b><br>
    admin / 1234<br>
    teacher / 1234<br>
    parent / 1234<br>
    student / 1234
  </div>

</div>
```

`;
}

async function login() {
const username =
document.getElementById("loginUsername").value.trim();

const password =
document.getElementById("loginPassword").value;

if (!username || !password) {
alert("أدخل اسم المستخدم وكلمة المرور");
return;
}

try {
const user = await api("/api/login", {
method: "POST",
body: JSON.stringify({
username,
password
})
});

```
me = user;

localStorage.setItem(
  "me",
  JSON.stringify(user)
);

render();
```

} catch (error) {
alert(error.message);
}
}

/* =========================
ACTIVITY
========================= */

async function activity() {
if (!me || !me.id) return;

try {
const result = await api("/api/activity", {
method: "POST",
body: JSON.stringify({
user_id: me.id
})
});

```
me.last_seen = result.last_seen;

localStorage.setItem(
  "me",
  JSON.stringify(me)
);
```

} catch (error) {

```
if (
  error.message.includes("موقوف") ||
  error.message.includes("الحساب")
) {
  logout();
}
```

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

await activity();

if (me.role === "admin") {
await adminPage();
return;
}

if (me.role === "teacher") {
await teacherPage();
return;
}

if (me.role === "parent") {
await parentPage();
return;
}

if (me.role === "student") {
await studentPage();
return;
}

app.innerHTML = `     <div class="wrap">       <h1>حساب غير معروف</h1>       <button onclick="logout()">خروج</button>     </div>
  `;
}

/* =========================
ADMIN PAGE
========================= */

async function adminPage() {

try {

```
const students =
  await api("/api/students");

const users =
  await api("/api/users");

const present =
  students.filter(
    student => student.status === "حاضر"
  ).length;

const absent =
  students.filter(
    student => student.status === "غائب"
  ).length;

const online =
  users.filter(
    user => user.online
  ).length;

app.innerHTML = `

  <div class="wrap">

    <div class="page-title">

      <div>
        <h1>لوحة الإدارة</h1>
        <p>
          مرحباً ${esc(me.name)}
        </p>
      </div>

      <button onclick="logout()">
        خروج
      </button>

    </div>

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
          ${present}
        </div>
      </div>

      <div class="card">
        الغائبون
        <div class="num">
          ${absent}
        </div>
      </div>

      <div class="card">
        المتصلون الآن
        <div class="num">
          ${online}
        </div>
      </div>

    </div>

    <section class="panel">

      <h2>👥 إدارة المستخدمين</h2>

      <h3>إضافة مستخدم جديد</h3>

      <div class="form row">

        <input
          id="newName"
          placeholder="اسم المستخدم">

        <input
          id="newUsername"
          placeholder="اسم الدخول">

        <input
          id="newPassword"
          type="password"
          placeholder="كلمة المرور">

        <select id="newRole">

          <option value="teacher">
            مدرس
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

        <button onclick="addUser()">
          ➕ إضافة المستخدم
        </button>

      </div>

      <div style="overflow-x:auto">

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>اسم المستخدم</th>
            <th>الصلاحية</th>
            <th>الحالة</th>
            <th>آخر نشاط</th>
            <th>الإجراء</th>
          </tr>

          ${users.map(user => {

            let status = "";

            if (!user.active) {
              status = "🔴 موقوف";
            } else if (user.online) {
              status = "🟢 متصل الآن";
            } else {
              status = "⚪ غير متصل";
            }

            let action = "";

            if (user.username === "admin") {

              action = `
                <b>المدير الرئيسي</b>
              `;

            } else if (user.active) {

              action = `
                <button
                  onclick="disableUser(${user.id})">
                  ⛔ إيقاف
                </button>

                <button
                  onclick="deleteUser(${user.id})">
                  🗑️ حذف
                </button>
              `;

            } else {

              action = `
                <button
                  onclick="enableUser(${user.id})">
                  ✅ تفعيل
                </button>

                <button
                  onclick="deleteUser(${user.id})">
                  🗑️ حذف
                </button>
              `;
            }

            return `
              <tr>

                <td>
                  ${esc(user.name)}
                </td>

                <td>
                  ${esc(user.username)}
                </td>

                <td>
                  ${roleName(user.role)}
                </td>

                <td>
                  ${status}
                </td>

                <td>
                  ${formatDate(user.last_seen)}
                </td>

                <td>
                  ${action}
                </td>

              </tr>
            `;

          }).join("")}

        </table>

      </div>

    </section>

    <section class="panel">

      <h2>👨‍🎓 الطلاب</h2>

      <div style="overflow-x:auto">

        <table class="table">

          <tr>
            <th>الاسم</th>
            <th>الفصل</th>
            <th>الحالة</th>
            <th>WhatsApp ولي الأمر</th>
          </tr>

          ${students.map(student => `

            <tr>

              <td>
                ${esc(student.name)}
              </td>

              <td>
                ${esc(student.class_name)}
              </td>

              <td>
                ${
                  student.status === "حاضر"
                    ? "🟢 حاضر"
                    : "🔴 غائب"
                }
              </td>

              <td>
                ${esc(student.parent_phone)}
              </td>

            </tr>

          `).join("")}

        </table>

      </div>

    </section>

    <section class="panel">

      <h2>➕ إضافة طالب</h2>

      <div class="form row">

        <input
          id="studentName"
          placeholder="اسم الطالب">

        <input
          id="studentClass"
          placeholder="الفصل">

        <input
          id="studentPhone"
          placeholder="رقم WhatsApp ولي الأمر">

        <button onclick="addStudent()">
          إضافة
        </button>

      </div>

    </section>

  </div>

`;
```

} catch (error) {

```
app.innerHTML = `
  <div class="wrap">

    <h2>حدث خطأ</h2>

    <div class="notice">
      ${esc(error.message)}
    </div>

    <button onclick="adminPage()">
      إعادة المحاولة
    </button>

  </div>
`;
```

}
}

/* =========================
ADD USER
========================= */

async function addUser() {

const name =
document.getElementById("newName").value.trim();

const username =
document.getElementById("newUsername").value.trim();

const password =
document.getElementById("newPassword").value;

const role =
document.getElementById("newRole").value;

if (!name || !username || !password) {
alert("أكمل بيانات المستخدم");
return;
}

try {

```
await api("/api/users", {
  method: "POST",
  body: JSON.stringify({
    name,
    username,
    password,
    role
  })
});

alert("تم إضافة المستخدم");

adminPage();
```

} catch (error) {

```
alert(error.message);
```

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

```
await api(
  `/api/users/${id}/disable`,
  {
    method: "PATCH"
  }
);

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================
ENABLE USER
========================= */

async function enableUser(id) {

try {

```
await api(
  `/api/users/${id}/enable`,
  {
    method: "PATCH"
  }
);

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================
DELETE USER
========================= */

async function deleteUser(id) {

if (!confirm("هل أنت متأكد من حذف المستخدم؟")) {
return;
}

try {

```
await api(
  `/api/users/${id}`,
  {
    method: "DELETE"
  }
);

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================
ADD STUDENT
========================= */

async function addStudent() {

const name =
document.getElementById("studentName").value.trim();

const className =
document.getElementById("studentClass").value.trim();

const phone =
document.getElementById("studentPhone").value.trim();

if (!name || !className || !phone) {
alert("أكمل بيانات الطالب");
return;
}

try {

```
await api("/api/students", {
  method: "POST",
  body: JSON.stringify({
    name,
    class_name: className,
    parent_phone: phone
  })
});

alert("تم إضافة الطالب بنجاح");

adminPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================
TEACHER
========================= */

async function teacherPage() {

try {

```
const students =
  await api("/api/students");

app.innerHTML = `

  <div class="wrap">

    <div class="page-title">

      <div>
        <h1>👨‍🏫 بوابة المدرس</h1>
        <p>
          ${esc(me.name)}
        </p>
      </div>

      <button onclick="logout()">
        خروج
      </button>

    </div>

    <section class="panel">

      <h2>📋 الحضور والغياب</h2>

      <table class="table">

        <tr>
          <th>الطالب</th>
          <th>الفصل</th>
          <th>الحالة</th>
          <th>الإجراء</th>
        </tr>

        ${students.map(student => `

          <tr>

            <td>
              ${esc(student.name)}
            </td>

            <td>
              ${esc(student.class_name)}
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
                onclick="toggleStatus(${student.id})">
                تغيير الحالة
              </button>

            </td>

          </tr>

        `).join("")}

      </table>

    </section>

    <section class="panel">

      <h2>📝 ملاحظة لولي الأمر</h2>

      <select id="noteStudent">

        ${students.map(student => `

          <option value="${student.id}">
            ${esc(student.name)}
          </option>

        `).join("")}

      </select>

      <textarea
        id="noteText"
        placeholder="اكتب الملاحظة">
      </textarea>

      <button onclick="saveNote()">
        💾 حفظ الملاحظة
      </button>

    </section>

    <section class="panel">

      <h2>🎥 فيديو الحصة</h2>

      <input
        id="videoTitle"
        placeholder="اسم المادة والحصة">

      <input
        id="videoFile"
        type="file"
        accept="video/*">

      <button onclick="saveVideo()">
        حفظ بيانات الفيديو
      </button>

      <div class="notice">
        حالياً يتم حفظ بيانات الفيديو فقط.
      </div>

    </section>

  </div>

`;
```

} catch (error) {

```
app.innerHTML = `
  <div class="wrap">

    <h2>حدث خطأ</h2>

    <div class="notice">
      ${esc(error.message)}
    </div>

    <button onclick="teacherPage()">
      إعادة المحاولة
    </button>

  </div>
`;
```

}
}

/* =========================
TOGGLE ATTENDANCE
========================= */

async function toggleStatus(id) {

try {

```
await api(
  `/api/students/${id}/status`,
  {
    method: "PATCH"
  }
);

teacherPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================
SAVE NOTE
========================= */

async function saveNote() {

const studentId =
document.getElementById("noteStudent").value;

const text =
document.getElementById("noteText").value.trim();

if (!text) {
alert("اكتب الملاحظة");
return;
}

try {

```
await api("/api/notes", {
  method: "POST",
  body: JSON.stringify({
    student_id: Number(studentId),
    text
  })
});

alert("تم حفظ الملاحظة");

teacherPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================
SAVE VIDEO
========================= */

async function saveVideo() {

const title =
document.getElementById("videoTitle").value.trim();

const file =
document.getElementById("videoFile").files[0];

if (!title) {
alert("اكتب اسم الحصة");
return;
}

try {

```
await api("/api/videos", {
  method: "POST",
  body: JSON.stringify({
    title,
    file_name: file ? file.name : ""
  })
});

alert("تم حفظ بيانات الحصة");

teacherPage();
```

} catch (error) {

```
alert(error.message);
```

}
}

/* =========================
PARENT
========================= */

async function parentPage() {

try {

```
const students =
  await api("/api/students");

const videos =
  await api("/api/videos");

if (!students.length) {

  app.innerHTML = `
    <div class="wrap">

      <h1>👨‍👩‍👦 بوابة ولي الأمر</h1>

      <div class="notice">
        لا يوجد طلاب حالياً.
      </div>

      <button onclick="logout()">
        خروج
      </button>

    </div>
  `;

  return;
}

const student =
  students[0];

const notes =
  await api(
    `/api/notes/${student.id}`
  );

app.innerHTML = `

  <div class="wrap">

    <div class="page-title">

      <div>
        <h1>👨‍👩‍👦 بوابة ولي الأمر</h1>
        <p>
          ${esc(me.name)}
        </p>
      </div>

      <button onclick="logout()">
        خروج
      </button>

    </div>

    <div class="cards">

      <div class="card">

        الطالب

        <div class="num">
          ${esc(student.name)}
        </div>

        <p>
          ${esc(student.class_name)}
        </p>

      </div>

      <div class="card">

        الحضور

        <div class="num">
          ${
            student.status === "حاضر"
              ? "🟢 حاضر"
              : "🔴 غائب"
          }
        </div>

      </div>

    </div>

    <section class="panel">

      <h2>📝 ملاحظات المدرسة</h2>

      ${
        notes.length
          ? notes.map(note => `

            <div class="notice">

              <b>
                ${esc(note.created_at)}
              </b>

              <br><br>

              ${esc(note.text)}

            </div>

          `).join("")
          : `
            <div class="card">
              لا توجد ملاحظات.
            </div>
          `
      }

    </section>

    <section class="panel">

      <h2>🎥 الحصص</h2>

      ${
        videos.length
          ? videos.map(video => `

            <div class="card">

              🎥 ${esc(video.title)}

              <br>

              <small>
                ${esc(video.created_at)}
              </small>

            </div>

          `).join("")
          : `
            <div class="card">
              لا توجد حصص.
            </div>
          `
      }

    </section>

  </div>

`;
```

} catch (error) {

```
app.innerHTML = `
  <div class="wrap">

    <h2>حدث خطأ</h2>

    <div class="notice">
      ${esc(error.message)}
    </div>

    <button onclick="parentPage()">
      إعادة المحاولة
    </button>

  </div>
`;
```

}
}

/* =========================
STUDENT
========================= */

async function studentPage() {

try {

```
const students =
  await api("/api/students");

const videos =
  await api("/api/videos");

const student =
  students.find(
    item => item.name === me.name
  ) || students[0];

if (!student) {

  app.innerHTML = `
    <div class="wrap">

      <h1>🎓 بوابة الطالب</h1>

      <div class="notice">
        لم يتم العثور على بيانات الطالب.
      </div>

      <button onclick="logout()">
        خروج
      </button>

    </div>
  `;

  return;
}

const notes =
  await api(
    `/api/notes/${student.id}`
  );

app.innerHTML = `

  <div class="wrap">

    <div class="page-title">

      <div>

        <h1>🎓 بوابة الطالب</h1>

        <p>
          ${esc(me.name)}
        </p>

      </div>

      <button onclick="logout()">
        خروج
      </button>

    </div>

    <div class="cards">

      <div class="card">

        الاسم

        <div class="num">
          ${esc(student.name)}
        </div>

      </div>

      <div class="card">

        الفصل

        <div class="num">
          ${esc(student.class_name)}
        </div>

      </div>

      <div class="card">

        الحضور

        <div class="num">
          ${
            student.status === "حاضر"
              ? "🟢 حاضر"
              : "🔴 غائب"
          }
        </div>

      </div>

    </div>

    <section class="panel">

      <h2>📝 الملاحظات</h2>

      ${
        notes.length
          ? notes.map(note => `

            <div class="notice">

              <b>
                ${esc(note.created_at)}
              </b>

              <br><br>

              ${esc(note.text)}

            </div>

          `).join("")
          : `
            <div class="card">
              لا توجد ملاحظات.
            </div>
          `
      }

    </section>

    <section class="panel">

      <h2>🎥 الحصص التعليمية</h2>

      ${
        videos.length
          ? videos.map(video => `

            <div class="card">

              🎥 ${esc(video.title)}

              <br>

              <small>
                ${esc(video.created_at)}
              </small>

            </div>

          `).join("")
          : `
            <div class="card">
              لا توجد حصص.
            </div>
          `
      }

    </section>

  </div>

`;
```

} catch (error) {

```
app.innerHTML = `
  <div class="wrap">

    <h2>حدث خطأ</h2>

    <div class="notice">
      ${esc(error.message)}
    </div>

    <button onclick="studentPage()">
      إعادة المحاولة
    </button>

  </div>
`;
```

}
}

/* =========================
ACTIVITY EVERY 30 SECONDS
========================= */

setInterval(() => {

if (me) {
activity();
}

}, 30000);

/* =========================
START APP
========================= */

try {

me = JSON.parse(
localStorage.getItem("me") || "null"
);

} catch (error) {

me = null;

localStorage.removeItem("me");
}

render();
