
"use strict";

// ==========================================
// AI-BASED BAPTISM CHURCH RECORD SYSTEM
// FRONTEND APPLICATION
// ==========================================

const $ = (selector) => document.querySelector(selector);

const loginView = $("#loginView");
const appView = $("#appView");
const loginForm = $("#loginForm");
const loginError = $("#loginError");
const registerForm = $("#registerForm");
let currentRole = "user";

const recordDialog = $("#recordDialog");
const recordForm = $("#recordForm");
const rowsElement = $("#rows");

let recordsCache = [];
let searchTimer = null;
let certificateLogoData = "";
let certificateBackgroundData = "";
let activeCertificate = null;

// ==========================================
// VIEW MANAGEMENT
// ==========================================

function showLogin() {
    loginView.hidden = false;
    loginView.style.display = "grid";
    appView.hidden = true;
    appView.style.display = "none";
}

function showDashboard() {
    loginView.hidden = true;
    loginView.style.display = "none";
    appView.hidden = false;
    appView.style.display = "block";
}

// ==========================================
// API HELPER
// ==========================================

async function api(url, options = {}) {
    const requestOptions = {
        credentials: "include",
        ...options,
        headers: {
            ...(options.body
                ? { "Content-Type": "application/json" }
                : {}),
            ...(options.headers || {})
        }
    };

    const response = await fetch(url, requestOptions);
    const contentType = response.headers.get("content-type") || "";

    let data = {};

    if (contentType.includes("application/json")) {
        data = await response.json();
    }

    if (!response.ok) {
        throw new Error(
            data.error || `Request failed (${response.status}).`
        );
    }

    return data;
}

// ==========================================
// USER AUTHENTICATION
// ==========================================
function setAuthMode(mode) {
    const registering = mode === "register";
    loginForm.hidden = registering;
    registerForm.hidden = !registering;
    $("#showUserLogin").classList.toggle("active", !registering);
    $("#showRegister").classList.toggle("active", registering);
    $("#authTitle").textContent = registering ? "Create your account" : "Sign in to your account";
    $("#authSubtitle").textContent = registering ? "Register to access the baptism registry." : "Enter your account details to continue.";
    loginError.textContent = "";
    $("#registerError").textContent = "";
}

$("#showUserLogin").addEventListener("click", () => setAuthMode("login"));
$("#showRegister").addEventListener("click", () => setAuthMode("register"));

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = registerForm.querySelector('button[type="submit"]');
    const name = registerForm.elements.name.value.trim();
    const email = registerForm.elements.email.value.trim();
    const password = registerForm.elements.password.value;
    const confirmPassword = registerForm.elements.confirmPassword.value;
    $("#registerError").textContent = "";
    if (password !== confirmPassword) { $("#registerError").textContent = "Passwords do not match."; return; }
    button.disabled = true; button.textContent = "Creating account...";
    try {
        await api("/api/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
        registerForm.reset();
        setAuthMode("login");
        loginForm.elements.email.value = email;
        loginError.textContent = "Account created successfully. Please sign in.";
        loginError.classList.add("success-message");
    } catch (error) { $("#registerError").textContent = error.message; }
    finally { button.disabled = false; button.innerHTML = 'Create account <span>→</span>'; }
});

function applyRoleUI() {
    const isAdmin = currentRole === "admin";
    $("#newRecord").hidden = !isAdmin;
    $("#dashboardRole").textContent = isAdmin ? "ADMINISTRATOR DASHBOARD" : "USER ACCESS · READ ONLY";
    $("#signedInLabel").textContent = isAdmin ? "Administrator" : "Signed in · Registry viewer";
    $("#aiButton").hidden = !isAdmin;
    $("#aiSummary").hidden = true;
}

// ==========================================
// LOGIN
// ==========================================

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = loginForm.querySelector('button[type="submit"]');

    loginError.textContent = "";

    if (button) {
        button.disabled = true;
        button.textContent = "Signing in...";
    }

    try {
        const credentials = {
            email: loginForm.elements.email.value.trim(),
            password: loginForm.elements.password.value
        };

        const result = await api("/api/user/login", {
            method: "POST",
            body: JSON.stringify(credentials)
        });

        if (!result.ok) {
            throw new Error("Login was not successful.");
        }

        loginForm.elements.password.value = "";
        currentRole = result.role || "user";
        applyRoleUI();

        showDashboard();
        await loadRecords();

    } catch (error) {
        console.error("Login error:", error);
        loginError.textContent = error.message;
        showLogin();

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Sign in";
        }
    }
});

// ==========================================
// LOGOUT
// ==========================================

$("#logout").addEventListener("click", async () => {
    try {
        await api("/api/logout", {
            method: "POST"
        });

        recordsCache = [];
        currentRole = "user";
        loginForm.reset();
        registerForm.reset();
        loginError.textContent = "";
        loginError.classList.remove("success-message");

        $("#rows").innerHTML = "";
        $("#total").textContent = "0";
        $("#latest").textContent = "—";

        showLogin();

    } catch (error) {
        console.error("Logout error:", error);
        alert(error.message);
    }
});

// ==========================================
// LOAD RECORDS
// ==========================================

async function loadRecords() {
    const search = $("#search").value.trim();

    try {
        const data = await api(
            "/api/records?q=" + encodeURIComponent(search)
        );

        recordsCache = Array.isArray(data) ? data : [];

        renderRecords();

    } catch (error) {
        console.error("Load records error:", error);

        if (error.message.toLowerCase().includes("session")) {
            showLogin();
            loginError.textContent = error.message;
            return;
        }

        $("#rows").innerHTML = "";
        $("#empty").hidden = false;
        $("#empty").textContent =
            "Unable to load records: " + error.message;
    }
}

// ==========================================
// HTML ESCAPING
// ==========================================

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));
}

// ==========================================
// DISPLAY RECORDS
// ==========================================

function renderRecords() {
    $("#total").textContent = recordsCache.length;

    $("#latest").textContent = recordsCache.length
        ? (recordsCache[0].baptismDate || "—")
        : "—";

    if (recordsCache.length === 0) {
        rowsElement.innerHTML = "";

        $("#empty").hidden = false;
        $("#empty").textContent =
            "No baptism records found. Click Add record to begin.";

        return;
    }

    $("#empty").hidden = true;

    rowsElement.innerHTML = recordsCache.map((record) => {
        const id = escapeHtml(record._id);

        return `
            <tr>
                <td>
                    <strong>
                        ${escapeHtml(record.firstName)}
                        ${escapeHtml(record.lastName)}
                    </strong>
                    <br>
                    <small>
                        ${escapeHtml(
                            record.certificateNo || "No certificate number"
                        )}
                    </small>
                </td>

                <td>${escapeHtml(record.baptismDate || "—")}</td>

                <td>${escapeHtml(record.parents || "—")}</td>

                <td>${escapeHtml(record.church || "—")}</td>

                <td>
                    ${currentRole === "admin" ? `
                        <button type="button" class="table-action" data-edit="${id}">Edit</button>
                        <button type="button" class="table-action" data-delete="${id}">Delete</button>
                    ` : ""}
                    <button type="button" class="table-action certificate-action" data-certificate="${id}">Certificate</button>
                </td>
            </tr>
        `;
    }).join("");
}

// ==========================================
// TABLE BUTTON EVENTS
// ==========================================

rowsElement.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    const certificateButton =
        event.target.closest("[data-certificate]");

    if (editButton) {
        editRecord(editButton.dataset.edit);

    } else if (deleteButton) {
        deleteRecord(deleteButton.dataset.delete);

    } else if (certificateButton) {
        openCertificate(certificateButton.dataset.certificate);
    }
});

// ==========================================
// SEARCH
// ==========================================

$("#search").addEventListener("input", () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(loadRecords, 300);
});

// ==========================================
// ADD RECORD
// ==========================================

function openBlankRecordForm() {
    recordForm.reset();

    recordForm.elements.id.value = "";

    $("#dialogTitle").textContent = "Add baptism record";
    $("#formError").textContent = "";

    recordDialog.showModal();
}

$("#newRecord").addEventListener("click", openBlankRecordForm);

// ==========================================
// EDIT RECORD
// ==========================================

function editRecord(id) {
    const record = recordsCache.find(
        (item) => String(item._id) === String(id)
    );

    if (!record) {
        alert("Record not found. Please refresh the registry.");
        return;
    }

    recordForm.reset();

    const fields = [
        "firstName",
        "lastName",
        "birthDate",
        "baptismDate",
        "parents",
        "minister",
        "church",
        "certificateNo",
        "notes"
    ];

    fields.forEach((field) => {
        if (recordForm.elements[field]) {
            recordForm.elements[field].value =
                record[field] || "";
        }
    });

    recordForm.elements.id.value = id;

    $("#dialogTitle").textContent = "Edit baptism record";
    $("#formError").textContent = "";

    recordDialog.showModal();
}

// ==========================================
// CLOSE RECORD DIALOG
// ==========================================

$("#closeDialog").addEventListener("click", () => {
    recordDialog.close();
});

$("#cancelDialog").addEventListener("click", () => {
    recordDialog.close();
});

// ==========================================
// SAVE RECORD
// ==========================================

recordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const body = Object.fromEntries(
        new FormData(recordForm)
    );

    const id = body.id;
    delete body.id;

    $("#formError").textContent = "";

    const saveButton =
        recordForm.querySelector('button[type="submit"]');

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    try {
        await api(
            id
                ? "/api/records/" + encodeURIComponent(id)
                : "/api/records",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(body)
            }
        );

        recordDialog.close();

        await loadRecords();

    } catch (error) {
        console.error("Save record error:", error);

        $("#formError").textContent = error.message;

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Save record";
        }
    }
});

// ==========================================
// DELETE RECORD
// ==========================================

async function deleteRecord(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this baptism record?"
    );

    if (!confirmed) return;

    try {
        await api(
            "/api/records/" + encodeURIComponent(id),
            {
                method: "DELETE"
            }
        );

        await loadRecords();

    } catch (error) {
        console.error("Delete record error:", error);
        alert(error.message);
    }
}

// ==========================================
// AI SUMMARY
// ==========================================

$("#aiButton").addEventListener("click", async () => {
    const button = $("#aiButton");
    const summary = $("#aiSummary");

    button.disabled = true;
    button.textContent = "Preparing...";

    summary.hidden = false;
    summary.textContent = "Generating registry summary...";

    try {
        const result = await api("/api/ai-summary", {
            method: "POST",
            body: JSON.stringify({
                period: "current registry"
            })
        });

        summary.textContent =
            result.summary || "No summary available.";

    } catch (error) {
        console.error("AI summary error:", error);

        summary.textContent =
            "Unable to generate summary: " + error.message;

    } finally {
        button.disabled = false;
        button.textContent = "Generate summary";
    }
});

// ==========================================
// CERTIFICATE GENERATOR
// Uses the certificate dialog already in
// index.html. Does not create another dialog.
// ==========================================

const certificateDialog = $("#certificateDialog");
const certificateDesign = $("#certificateDesign");

// ==========================================
// DATE FORMATTER
// ==========================================

function formatCertificateDate(value) {
    if (!value) return "—";

    const parts = String(value).split("-");

    if (parts.length !== 3) {
        return escapeHtml(value);
    }

    const date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

// ==========================================
// SET CERTIFICATE TEXT
// ==========================================

function setCertificateText(
    selector,
    value,
    fallback = "—"
) {
    const element = $(selector);

    if (element) {
        element.textContent = value
            ? String(value)
            : fallback;
    }
}

// ==========================================
// RENDER CERTIFICATE
// ==========================================

function renderCertificate(record) {
    setCertificateText(
        "#certChurch",
        record.church,
        "CHURCH / PARISH NAME"
    );

    setCertificateText(
        "#certChildName",
        `${record.firstName || ""} ${record.lastName || ""}`.trim(),
        "CHILD'S FULL NAME"
    );

    setCertificateText(
        "#certBirthDate",
        formatCertificateDate(record.birthDate)
    );

    setCertificateText(
        "#certBaptismDate",
        formatCertificateDate(record.baptismDate)
    );

    setCertificateText(
        "#certMinister",
        record.minister
    );

    setCertificateText(
        "#certParents",
        record.parents
    );

    setCertificateText(
        "#certMinisterSignature",
        record.minister || ""
    );

    setCertificateText(
        "#certNumber",
        record.certificateNo
    );

    setCertificateText(
        "#certIssuedDate",
        new Date().toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric"
        })
    );

    // Certificate logo
    const logoPreview = $("#certificateLogoPreview");

    if (certificateLogoData) {
        logoPreview.src = certificateLogoData;
        logoPreview.hidden = false;

    } else {
        logoPreview.removeAttribute("src");
        logoPreview.hidden = true;
    }

    // Certificate background
    certificateDesign.style.backgroundImage =
        certificateBackgroundData
            ? `url("${certificateBackgroundData}")`
            : "none";

    certificateDesign.style.backgroundSize = "100% 100%";
    certificateDesign.style.backgroundPosition = "center";
    certificateDesign.style.backgroundRepeat = "no-repeat";
}

// ==========================================
// OPEN CERTIFICATE
// ==========================================

function openCertificate(id) {
    activeCertificate = recordsCache.find(
        (item) => String(item._id) === String(id)
    );

    if (!activeCertificate) {
        alert("Record not found. Please refresh the registry.");
        return;
    }

    renderCertificate(activeCertificate);

    certificateDialog.showModal();
}

// ==========================================
// CLOSE CERTIFICATE
// ==========================================

$("#closeCertificate").addEventListener("click", () => {
    certificateDialog.close();
});

$("#closeCertificateBottom").addEventListener("click", () => {
    certificateDialog.close();
});

// ==========================================
// CERTIFICATE IMAGE UPLOAD
// ==========================================

function handleCertificateImage(input, imageType) {
    input.addEventListener("change", () => {
        const file = input.files && input.files[0];

        if (!file) return;

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            alert("Please select a PNG, JPG, or WEBP image.");
            input.value = "";
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert("Please select an image smaller than 2 MB.");
            input.value = "";
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            if (imageType === "logo") {
                certificateLogoData = String(reader.result || "");

            } else {
                certificateBackgroundData =
                    String(reader.result || "");
            }

            if (activeCertificate) {
                renderCertificate(activeCertificate);
            }
        };

        reader.onerror = () => {
            alert(
                "Unable to read the selected image. Please try another file."
            );

            input.value = "";
        };

        reader.readAsDataURL(file);
    });
}

handleCertificateImage($("#certificateLogo"), "logo");

handleCertificateImage(
    $("#certificateBackground"),
    "background"
);

// ==========================================
// PRINT CERTIFICATE
// ==========================================

$("#printCertificate").addEventListener("click", () => {
    if (!activeCertificate) {
        alert("Please open a baptism record first.");
        return;
    }

    const printWindow = window.open(
        "",
        "_blank",
        "width=1200,height=850"
    );

    if (!printWindow) {
        alert(
            "The print window was blocked. Allow pop-ups for localhost and try again."
        );

        return;
    }

    const certificateHtml =
        certificateDesign.outerHTML;

    const printStyles = `
        @page {
            size: A4 landscape;
            margin: 0;
        }

        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        html, body {
            margin: 0;
            padding: 0;
            width: 297mm;
            min-height: 210mm;
            font-family: Georgia, "Times New Roman", serif;
            color: #38291f;
        }

        #certificateDesign {
            width: 297mm;
            height: 210mm;
            padding: 9mm;
            background-color: #fffdf7;
            background-size: 100% 100%;
            background-position: center;
            background-repeat: no-repeat;
            overflow: hidden;
        }

        .certificate-border {
            width: 100%;
            height: 100%;
            border: 3px double #a84430;
            outline: 1px solid #d6b36a;
            outline-offset: -7mm;
            text-align: center;
            padding: 10mm 18mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        .certificate-logo {
            max-width: 22mm;
            max-height: 22mm;
            object-fit: contain;
            margin-bottom: 3mm;
        }

        .certificate-church {
            font-size: 15pt;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin: 0 0 5mm;
            font-weight: bold;
        }

        .certificate-kicker {
            font-size: 11pt;
            letter-spacing: 3px;
            margin: 0 0 2mm;
        }

        #certificateDesign h1 {
            font-size: 30pt;
            color: #8e3829;
            margin: 0 0 3mm;
        }

        #certificateDesign h2 {
            font-size: 22pt;
            color: #8e3829;
            margin: 2mm 0;
        }

        .certificate-rule {
            width: 65%;
            border-top: 1px solid #c49a52;
            margin: 0 0 3mm;
        }

        .certificate-body {
            font-size: 12pt;
            margin: 2mm 0;
        }

        .certificate-footer {
            width: 100%;
            display: flex;
            justify-content: space-around;
            gap: 10mm;
            margin-top: 9mm;
        }

        .certificate-footer div {
            width: 42%;
            border-top: 1px solid #59483b;
            padding-top: 2mm;
        }

        .certificate-footer span {
            display: block;
            min-height: 5mm;
            font-size: 10pt;
        }

        .certificate-footer small {
            font: 8pt Arial, sans-serif;
            letter-spacing: 1px;
        }

        .certificate-issued {
            font: 9pt Arial, sans-serif;
            margin: 3mm 0 0;
            color: #62564d;
        }

        @media print {
            html, body {
                width: 297mm;
                height: 210mm;
            }
        }
    `;

    printWindow.document.open();

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Baptismal Certificate</title>
            <style>${printStyles}</style>
        </head>

        <body>
            ${certificateHtml}

            <script>
                window.onload = function () {
                    window.focus();
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `);

    printWindow.document.close();
});

// ==========================================
// INITIAL PAGE
// ==========================================

showLogin();
(async function restoreSession() {
    try {
        const session = await api("/api/me");
        if (session.authenticated) {
            currentRole = session.role || "user";
            applyRoleUI();
            showDashboard();
            await loadRecords();
        }
    } catch (error) {
        console.warn("Unable to restore session:", error.message);
    }
})();

console.log("Baptism Church Record System loaded.");
