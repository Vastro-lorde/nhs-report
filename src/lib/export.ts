export function exportToCSV<T extends Record<string, any>>(data: T[], filename: string) {
    if (!data || !data.length) return;

    // Extract headers
    const headers = Object.keys(data[0]);

    // Build CSV string
    const csvRows = [];

    // 1. Add headers row
    csvRows.push(headers.join(","));

    // 2. Add data rows
    for (const row of data) {
        const values = headers.map((header) => {
            let val = row[header];
            if (val === null || val === undefined) {
                val = "";
            } else if (Array.isArray(val)) {
                val = val.join("; "); // Join array elements with a semicolon
            } else if (typeof val === "object") {
                val = JSON.stringify(val); // Serialize objects if they exist
            }

            // Escape quotes and wrap in quotes if there's a comma, quote, or newline
            const strVal = String(val);
            if (strVal.includes(",") || strVal.includes("\"") || strVal.includes("\n")) {
                return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
        });
        csvRows.push(values.join(","));
    }

    const csvString = csvRows.join("\n");

    // Create a blob and trigger download
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
