// Data opslag in localStorage
let planten = JSON.parse(localStorage.getItem('planten') || '[]');
// geselecteerd will now store objects {id: string, quantity: number}
let geselecteerd = JSON.parse(localStorage.getItem('geselecteerd') || '[]');

// Ensure geselecteerd array elements are objects with id and quantity
// This handles backward compatibility if old data (array of strings) exists in localStorage
if (Array.isArray(geselecteerd) && geselecteerd.length > 0) {
    if (typeof geselecteerd[0] === 'string') { // Old format: array of strings
        geselecteerd = geselecteerd.map(id => ({ id: id, quantity: 1 }));
        save(); // Save the converted format
    }
} else if (!Array.isArray(geselecteerd)) {
    // If somehow it's not an array (corrupted data), initialize as empty
    geselecteerd = [];
}


let bewerkId = null;

// PDF instellingen
function getDefaultPdfSettings() {
  return {
    title: "Mijn Plantenlijst",
    titleColor: "#388e3c",
    fontSize: 12,
    header: "",
    logoUrl: "",
    columns: ["afbeelding", "naam", "botanisch", "soort", "prijs", "omschrijving"],
    showColumnHeaders: true,
    colWidths: {},
    colNames: {},
    align: {},
    fontFamily: "Roboto",
    rowColors: ["#fff", "#f8f8f8"],
    borderColor: "#888",
    exportDate: new Date().toISOString().split('T')[0],
    companyInfo: "Jouw Bedrijfsnaam, Adres, Postcode Plaats, Telefoon, E-mail"
  };
}
let pdfSettings = {};
function loadPDFSettings() {
  pdfSettings = Object.assign(getDefaultPdfSettings(), JSON.parse(localStorage.getItem('pdfSettings') || 'null') || {});
}
loadPDFSettings();


function save() {
  localStorage.setItem('planten', JSON.stringify(planten));
  localStorage.setItem('geselecteerd', JSON.stringify(geselecteerd)); // Save selected items
}

function savePDFSettings() {
  localStorage.setItem('pdfSettings', JSON.stringify(pdfSettings));
  console.log("PDF instellingen opgeslagen:", pdfSettings); // DEBUG: Toon opgeslagen instellingen
}

// Filter met OF-logica (zon, schaduw = alles met zon OF schaduw)
function renderTable(filter = '') {
  const tbody = document.querySelector('#plant-table tbody');
  tbody.innerHTML = '';
  const filters = filter
    .split(',')
    .map(f => f.trim().toLowerCase())
    .filter(f => f.length > 0);

  planten
    .filter(p => {
      const fields = [
        p.naam || '',
        p.botanisch || '',
        p.soort || '',
        p.omschrijving || ''
      ];
      return filters.length === 0 ||
        filters.some(f =>
          fields.some(field => field.toLowerCase().includes(f))
        );
    })
    .forEach(p => {
      const tr = document.createElement('tr');
      // Voeg 'data-id' toe aan de rij voor gemakkelijke selectie
      tr.dataset.id = p.id; 
      // Check if the plant is selected based on its id in the geselecteerd array
      const isSelected = geselecteerd.some(item => item.id === p.id);
      if (isSelected) tr.classList.add('selected-row');

      // Truncate description for table display
      const maxDescriptionLength = 100; // Max characters for description in table
      let displayOmschrijving = p.omschrijving || "";
      if (displayOmschrijving.length > maxDescriptionLength) {
        displayOmschrijving = displayOmschrijving.substring(0, maxDescriptionLength) + '... <span class="read-more" title="Klik om de volledige omschrijving te zien" data-id="${p.id}">lees meer</span>';
      }


      tr.innerHTML = `
        <td><input type="checkbox" class="row-checkbox" data-id="${p.id}" ${isSelected ? 'checked' : ''}></td>
        <td class="img-cell">
          ${p.afbeelding
            ? `<img class="thumbnail" src="${p.afbeelding}" alt="afbeelding van ${p.naam}">`
            : '<div class="thumbnail placeholder"></div>'}
        </td>
        <td>${p.naam}</td>
        <td>${p.botanisch || ""}</td>
        <td>${p.soort}</td>
        <td>€ ${Number(p.prijs).toFixed(2)}</td>
        <td class="description-cell">${displayOmschrijving}</td>
        <td class="actions-cell">
          <button class="edit-btn" data-id="${p.id}" title="Bewerk plant"><i class="fas fa-edit"></i></button>
          <button class="delete-btn" data-id="${p.id}" title="Verwijder plant"><i class="fas fa-trash-alt"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  
  // Add event listener for "lees meer" functionality
  tbody.querySelectorAll('.read-more').forEach(span => {
    span.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent row selection when clicking "lees meer"
      const plantId = this.dataset.id;
      const plant = planten.find(p => p.id === plantId);
      if (plant) {
        showPlantDetailModal(plant);
      }
    });
  });

  updateExportButtons();
  updateSelectAllCheckbox(); // Controleer de "Selecteer alles" checkbox
}

function updateExportButtons() {
  const hasSelection = geselecteerd.length > 0;
  document.getElementById('export-pdf').disabled = !hasSelection;
  document.getElementById('delete-selected').disabled = !hasSelection;
  document.getElementById('view-selection').disabled = !hasSelection;
  // This button is in the basket modal, will be handled when basket modal is shown
  // document.getElementById('export-basket-pdf').disabled = !hasSelection; 
}

function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
        // Alleen de niet-gefilterde, getoonde planten tellen
        const currentFilteredPlants = planten.filter(p => {
            const filters = document.getElementById('filter').value
                .split(',')
                .map(f => f.trim().toLowerCase())
                .filter(f => f.length > 0);
            const fields = [p.naam || '', p.botanisch || '', p.soort || '', p.omschrijving || ''];
            return filters.length === 0 || filters.some(f => fields.some(field => field.toLowerCase().includes(f)));
        });

        // Check if all filtered plants are selected
        const allFilteredSelected = currentFilteredPlants.every(p => geselecteerd.some(item => item.id === p.id));

        if (currentFilteredPlants.length > 0 && allFilteredSelected) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (geselecteerd.length > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
    }
}


// ----------- AFBEELDING RESIZE FUNCTIE -----------
async function resizeImage(file, maxWidth = 200, maxHeight = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new window.Image();
      img.onload = function() {
        let [iw, ih] = [img.width, img.height];
        let scale = Math.min(maxWidth / iw, maxHeight / ih, 1);
        let w = Math.round(iw * scale);
        let h = Math.round(ih * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Bewerken functionaliteit
document.getElementById('plant-form').addEventListener('submit', async e => {
  e.preventDefault();
  const naam = document.getElementById('naam').value;
  const botanisch = document.getElementById('botanisch').value;
  const soort = document.getElementById('soort').value;
  const prijs = document.getElementById('prijs').value || 0;
  const afbeeldingInput = document.getElementById('afbeelding');
  const omschrijving = document.getElementById('omschrijving').value;
  let afbeelding = "";

  if (afbeeldingInput.files && afbeeldingInput.files[0]) {
    afbeelding = await resizeImage(afbeeldingInput.files[0], 200, 200);
  }

  if (bewerkId) {
    const plant = planten.find(p => p.id === bewerkId);
    if (plant) {
      plant.naam = naam;
      plant.botanisch = botanisch;
      plant.soort = soort;
      plant.prijs = prijs;
      plant.omschrijving = omschrijving;
      if (afbeelding) {
        plant.afbeelding = afbeelding;
      }
    }
    bewerkId = null;
    document.getElementById('plant-form').querySelector('button[type="submit"]').textContent = 'Plant toevoegen'; // Tekst update
  } else {
    const id = Date.now().toString();
    planten.push({ id, naam, botanisch, soort, prijs, omschrijving, afbeelding });
  }
  save();
  e.target.reset();
  renderTable(document.getElementById('filter').value);
});

document.getElementById('filter').addEventListener('input', e => {
  renderTable(e.target.value);
});

// Event listener voor Selecteer alles checkbox
document.getElementById('select-all').addEventListener('change', function() {
    geselecteerd = []; // Wis alle vorige selecties
    const isChecked = this.checked;

    const checkboxes = document.querySelectorAll('#plant-table .row-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const rowId = checkbox.dataset.id;
        if (isChecked) {
            if (!geselecteerd.some(item => item.id === rowId)) {
                geselecteerd.push({ id: rowId, quantity: 1 });
            }
        }
    });
    save(); // Save the updated geselecteerd array
    renderTable(document.getElementById('filter').value); // Herrender de tabel om de geselecteerde klassen toe te passen
});


document.querySelector('#plant-table tbody').addEventListener('click', function(e) {
  const tr = e.target.closest('tr');
  if (!tr) return;

  const id = tr.dataset.id;
  const checkbox = tr.querySelector('.row-checkbox');

  // Controleer of de klik op een van de actieknoppen was
  if (e.target.closest('.edit-btn')) {
    const plant = planten.find(p => p.id === id);
    if (plant) {
      document.getElementById('naam').value = plant.naam;
      document.getElementById('botanisch').value = plant.botanisch || "";
      document.getElementById('soort').value = plant.soort;
      document.getElementById('prijs').value = plant.prijs;
      document.getElementById('omschrijving').value = plant.omschrijving || "";
      document.getElementById('afbeelding').value = ""; // Reset file input
      bewerkId = id;
      document.getElementById('plant-form').querySelector('button[type="submit"]').textContent = 'Opslaan';
    }
    return; // Stop verdere verwerking
  }
  if (e.target.closest('.delete-btn')) {
    const plant = planten.find(p => p.id === id);
    if (plant) {
      const confirmMsg = `Weet je zeker dat je "${plant.naam}" wilt verwijderen? Deze actie kan niet ongedaan gemaakt worden.`;
      if (confirm(confirmMsg)) {
        planten = planten.filter(p => p.id !== id);
        geselecteerd = geselecteerd.filter(item => item.id !== id); // Verwijder ook uit selectie
        save();
        renderTable(document.getElementById('filter').value);
      }
    }
    return; // Stop verdere verwerking
  }

  // Als de klik niet op een actieknop was, toggle selectie van de rij
  if (checkbox && e.target.nodeName !== 'SPAN' && !e.target.classList.contains('read-more')) { // Prevent toggling when clicking "lees meer"
    checkbox.checked = !checkbox.checked;
    if (checkbox.checked) {
      if (!geselecteerd.some(item => item.id === id)) geselecteerd.push({ id: id, quantity: 1 });
    } else {
      geselecteerd = geselecteerd.filter(item => item.id !== id);
    }
    save(); // Save the updated geselecteerd array
    renderTable(document.getElementById('filter').value); // Herrender voor visuele update
  }
});


// ----------- ALGEMEEN VERWIJDEREN GESELECTEERDE PLANTEN -----------
document.getElementById('delete-selected').addEventListener('click', function() {
    if (geselecteerd.length === 0) {
        alert('Selecteer minimaal één plant om te verwijderen.');
        return;
    }

    const confirmMsg = `Weet je zeker dat je de ${geselecteerd.length} geselecteerde planten wilt verwijderen? Deze actie kan niet ongedaan gemaakt worden.`;
    if (confirm(confirmMsg)) {
        // Filter de plantenlijst, behoud alleen de planten waarvan de ID NIET in de geselecteerde lijst staat
        const selectedIds = geselecteerd.map(item => item.id);
        planten = planten.filter(p => !selectedIds.includes(p.id));
        geselecteerd = []; // Wis de selectie na verwijderen
        save();
        renderTable(document.getElementById('filter').value);
    }
});

// Helper function to add footer to PDF
async function addPdfFooter(doc, pageNumber, totalPages) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 10;
  const bottomMargin = 10;

  let currentY = pageHeight - bottomMargin - (pdfSettings.fontSize * 0.8); // Adjusted for smaller font

  // Company Info (left-aligned)
  doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
  doc.setFontSize(pdfSettings.fontSize * 0.8); // Smaller font for footer
  doc.setTextColor(100); // Grey color
  
  const companyInfoLines = doc.splitTextToSize(pdfSettings.companyInfo, pageWidth / 2 - leftMargin); // Split for half page width
  doc.text(companyInfoLines, leftMargin, currentY);

  // Logo (bottom-left)
  if (pdfSettings.logoUrl) {
    try {
      const imgData = await toDataURL(pdfSettings.logoUrl);
      const logoWidth = 20; // Smaller logo in footer
      const logoHeight = 20;
      doc.addImage(imgData, 'PNG', leftMargin, pageHeight - bottomMargin - logoHeight, logoWidth, logoHeight);
      currentY = Math.min(currentY, pageHeight - bottomMargin - logoHeight - 5); // Adjust text position if logo is taller
    } catch (err) {
      console.error("Fout bij het laden van logo voor PDF footer:", err);
    }
  }

  // Page Number (bottom-right)
  doc.text(`Pagina ${pageNumber} van ${totalPages}`, pageWidth - leftMargin, pageHeight - bottomMargin, { align: 'right' });
}


document.getElementById('export-pdf').addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 15; // Slightly larger left margin for content
  const rightMargin = 15;
  const topMargin = 20; // Space for header
  const bottomMargin = 30; // Space for footer
  const availableWidth = pageWidth - leftMargin - rightMargin;
  const availableHeight = pageHeight - topMargin - bottomMargin;
  const lineHeight = 7; // Standard line height for text

  let y = topMargin; // Starting Y position

  const selectie = planten.filter(p => geselecteerd.some(item => item.id === p.id));

  if (selectie.length === 0) {
    alert('Geen planten geselecteerd om te exporteren.');
    return;
  }

  // Header content
  doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
  doc.setFontSize(pdfSettings.fontSize + 8); // Larger font for title
  doc.setTextColor(pdfSettings.titleColor);
  doc.text(pdfSettings.title, leftMargin, y);

  doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
  doc.setFontSize(pdfSettings.fontSize);
  doc.setTextColor(50); // Darker grey for date/header
  doc.text(`Datum: ${pdfSettings.exportDate}`, pageWidth - rightMargin, y, { align: 'right' });
  y += 15; // Space after title and date

  // Line under header
  doc.setDrawColor(pdfSettings.titleColor);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 10; // Space after line


  const plantBlockMinHeight = 100; // Estimated minimum height for each plant block
  const imageSize = 40; // Square image size in mm
  const textLeftOffset = leftMargin + imageSize + 10; // Text starts after image + padding

  for (let i = 0; i < selectie.length; i++) {
    const p = selectie[i];

    let startYForBlock = y; // Remember starting Y for this block

    // Check for new page before drawing block content
    if (y + plantBlockMinHeight > pageHeight - bottomMargin) {
      await addPdfFooter(doc, doc.internal.getNumberOfPages(), selectie.length); // Add footer to current page
      doc.addPage();
      y = topMargin; // Reset Y for new page
      startYForBlock = y; // Reset startYForBlock
       // Redraw header on new page
      doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
      doc.setFontSize(pdfSettings.fontSize + 8);
      doc.setTextColor(pdfSettings.titleColor);
      doc.text(pdfSettings.title, leftMargin, y);

      doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
      doc.setFontSize(pdfSettings.fontSize);
      doc.setTextColor(50);
      doc.text(`Datum: ${pdfSettings.exportDate}`, pageWidth - rightMargin, y, { align: 'right' });
      y += 15;

      doc.setDrawColor(pdfSettings.titleColor);
      doc.setLineWidth(0.5);
      doc.line(leftMargin, y, pageWidth - rightMargin, y);
      y += 10;
    }


    // Plant Image (left aligned)
    if (p.afbeelding && pdfSettings.columns.includes("afbeelding")) {
      try {
        const img = new window.Image();
        img.src = p.afbeelding;
        await new Promise((resolve, reject) => {
          img.onload = () => {
            // Calculate scale to fit image into square, maintaining aspect ratio.
            // If image is not square, it will be cropped by addImage
            doc.addImage(p.afbeelding, 'JPEG', leftMargin, y, imageSize, imageSize);
            resolve();
          };
          img.onerror = (err) => {
            console.error("Fout bij het laden van plantafbeelding voor PDF:", err);
            resolve(); // Resolve even on error to not block PDF generation
          };
        });
      } catch (err) {
        console.error("Fout bij het toevoegen van plantafbeelding aan PDF:", err);
      }
    }

    let currentYForText = y + (pdfSettings.fontSize / 2); // Start text slightly below image top

    // Plant Name (prominent)
    doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
    doc.setFontSize(pdfSettings.fontSize + 4); // Larger font for name
    doc.setTextColor(pdfSettings.titleColor); // Use primary color for name
    doc.text(p.naam, textLeftOffset, currentYForText);
    currentYForText += pdfSettings.fontSize + 5;

    // Botanical Name (slightly smaller, below name)
    if (p.botanisch && pdfSettings.columns.includes("botanisch")) {
      doc.setFont(pdfSettings.fontFamily || "helvetica", "italic");
      doc.setFontSize(pdfSettings.fontSize);
      doc.setTextColor(80); // Dark grey
      doc.text(`(${p.botanisch})`, textLeftOffset, currentYForText);
      currentYForText += pdfSettings.fontSize + 5;
    }

    // Soort and Prijs (smaller, on one line)
    doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
    doc.setFontSize(pdfSettings.fontSize);
    doc.setTextColor(50); // Medium grey
    
    let detailLine = [];
    if (p.soort && pdfSettings.columns.includes("soort")) {
      detailLine.push(`Soort: ${p.soort}`);
    }
    if (p.prijs && pdfSettings.columns.includes("prijs")) {
      detailLine.push(`Prijs: €${Number(p.prijs).toFixed(2)}`);
    }
    if (detailLine.length > 0) {
      doc.text(detailLine.join(' | '), textLeftOffset, currentYForText);
      currentYForText += lineHeight + 2;
    }
    
    // Ensure description starts below image if image is taller than text block
    currentYForText = Math.max(currentYForText, y + imageSize + 5);

    // Omschrijving (Description)
    if (p.omschrijving && pdfSettings.columns.includes("omschrijving")) {
      doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
      doc.setFontSize(pdfSettings.fontSize - 1); // Slightly smaller for description
      doc.setTextColor(30); // Almost black
      
      const descriptionTextWidth = availableWidth - (leftMargin + 5); // Description takes full available width below image, or full width if no image
      
      // If image exists, draw description next to it first, then full width below
      let descriptionLines;
      if (p.afbeelding && pdfSettings.columns.includes("afbeelding")) {
          // Calculate lines for description next to image
          let linesNextToImage = doc.splitTextToSize(p.omschrijving, availableWidth - imageSize - 15);
          let currentDescriptionY = currentYForText;
          let remainingDescription = p.omschrijving;

          // Draw as many lines as fit next to the image
          for (let line of linesNextToImage) {
              if (currentDescriptionY + lineHeight <= y + imageSize + 5) { // Check if line fits next to image
                  doc.text(line, textLeftOffset, currentDescriptionY);
                  currentDescriptionY += lineHeight;
                  remainingDescription = remainingDescription.substring(line.length).trim();
              } else {
                  break; // No more space next to image
              }
          }
          // If there's remaining description, draw it below the image, full width
          if (remainingDescription.length > 0) {
              const fullWidthDescriptionLines = doc.splitTextToSize(remainingDescription, availableWidth);
              doc.text(fullWidthDescriptionLines, leftMargin, y + imageSize + 10);
              currentYForText = Math.max(currentYForText, y + imageSize + 10 + (fullWidthDescriptionLines.length * lineHeight));
          } else {
            currentYForText = Math.max(currentYForText, currentDescriptionY); // Update y based on text drawn next to image
          }

      } else { // No image, description takes full width from start
          descriptionLines = doc.splitTextToSize(p.omschrijving, availableWidth);
          doc.text(descriptionLines, leftMargin, currentYForText);
          currentYForText += descriptionLines.length * lineHeight;
      }
    }

    // Update main y cursor for next plant
    y = Math.max(y + plantBlockMinHeight, currentYForText + 5); // Ensure enough space for description, or a minimum block height
    
    // Separator line with small gap
    if (i < selectie.length - 1) { // Don't draw line after last item
      doc.setDrawColor(pdfSettings.borderColor || 220);
      doc.setLineWidth(0.2); // Thinner separator
      doc.line(leftMargin, y, pageWidth - rightMargin, y);
      y += 5; // Space after separator
    } else {
      y += 10; // Just add some space after the last item
    }
  }

  // Final total price if 'prijs' column is selected
  if (pdfSettings.columns.includes("prijs")) {
    const totaal = selectie.reduce((sum, p) => sum + Number(p.prijs), 0);
    // Check for page break before adding total
    if (y + 20 > pageHeight - bottomMargin) {
      await addPdfFooter(doc, doc.internal.getNumberOfPages(), selectie.length);
      doc.addPage();
      y = topMargin;
    }
    doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
    doc.setFontSize(pdfSettings.fontSize + 2); // Slightly larger font for total
    doc.setTextColor("#388e3c");
    doc.text(`Totaal geselecteerde planten: €${totaal.toFixed(2)}`, leftMargin, y + lineHeight);
    y += 15;
  }

  // Add footer to the last page after all content is rendered
  await addPdfFooter(doc, doc.internal.getNumberOfPages(), doc.internal.getNumberOfPages()); // Pass total pages for final page count

  doc.save('planten.pdf');
});

function toDataURL(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ----------- PDF INSTELLINGEN MODAL -----------
function showPDFSettingsModal() {
  const modal = document.getElementById('pdf-settings-modal');
  modal.style.display = 'flex';

  document.getElementById('pdf-title').value = pdfSettings.title;
  document.getElementById('pdf-title-color').value = pdfSettings.titleColor;
  document.getElementById('pdf-font-size').value = pdfSettings.fontSize;
  document.getElementById('pdf-header').value = pdfSettings.header || ""; // This is now for general header info, potentially for company name.
  document.getElementById('pdf-logo-url').value = pdfSettings.logoUrl || "";
  document.getElementById('pdf-export-date').value = pdfSettings.exportDate; // New: Date input
  document.getElementById('pdf-company-info').value = pdfSettings.companyInfo; // New: Company info input

  document.querySelectorAll('.col-toggle').forEach(box => {
    box.checked = pdfSettings.columns.includes(box.dataset.col);
  });

  document.getElementById('pdf-show-column-headers').checked = pdfSettings.showColumnHeaders !== false;
}
function hidePDFSettingsModal() {
  document.getElementById('pdf-settings-modal').style.display = 'none';
}

document.getElementById('show-pdf-settings').addEventListener('click', showPDFSettingsModal);
document.getElementById('close-pdf-modal').addEventListener('click', hidePDFSettingsModal);

// PDF settings form submission handler - REPLACE the existing one in app.js
document.getElementById('pdf-settings-form').addEventListener('submit', e => {
  e.preventDefault();
  
  // Save all form values to pdfSettings
  pdfSettings.title = document.getElementById('pdf-title').value;
  pdfSettings.titleColor = document.getElementById('pdf-title-color').value;
  pdfSettings.fontSize = parseInt(document.getElementById('pdf-font-size').value, 10);
  pdfSettings.header = document.getElementById('pdf-header').value;
  pdfSettings.logoUrl = document.getElementById('pdf-logo-url').value;
  pdfSettings.exportDate = document.getElementById('pdf-export-date').value;
  pdfSettings.companyInfo = document.getElementById('pdf-company-info').value;
  
  // Save selected columns
  pdfSettings.columns = Array.from(document.querySelectorAll('.col-toggle'))
    .filter(box => box.checked)
    .map(box => box.dataset.col);
  
  // Save column headers setting
  pdfSettings.showColumnHeaders = document.getElementById('pdf-show-column-headers').checked;
  
  // Save to localStorage
  savePDFSettings();
  
  // Close the modal automatically
  hidePDFSettingsModal();
  
  // Optional: Show a brief success message
  console.log("PDF instellingen opgeslagen en modal gesloten");
});

// ----------- BASKET MODAL FUNCTIES -----------
function showBasketModal() {
  const modal = document.getElementById('basket-modal');
  const basketContent = document.getElementById('basket-content');
  const exportBasketPdfButton = document.getElementById('export-basket-pdf');
  basketContent.innerHTML = ''; // Clear previous content

  // Merge plant data with selected quantities
  const selectedPlantsWithDetails = geselecteerd.map(selectedItem => {
    const plantDetail = planten.find(p => p.id === selectedItem.id);
    return plantDetail ? { ...plantDetail, quantity: selectedItem.quantity } : null;
  }).filter(item => item !== null);

  if (selectedPlantsWithDetails.length === 0) {
    basketContent.innerHTML = '<p>Geen planten geselecteerd in het mandje.</p>';
    exportBasketPdfButton.disabled = true;
    modal.style.display = 'flex';
    return;
  }

  // Create a table for selected plants
  const table = document.createElement('table');
  table.classList.add('basket-table');

  // Table Header
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Afbeelding</th>
      <th>Naam</th>
      <th>Soort</th>
      <th>Prijs</th>
      <th>Aantal</th>
      <th>Totaal Prijs</th>
      <th>Acties</th>
    </tr>
  `;
  table.appendChild(thead);

  // Table Body
  const tbody = document.createElement('tbody');
  selectedPlantsWithDetails.forEach(p => {
    const tr = document.createElement('tr');
    const totalItemPrice = (Number(p.prijs) * p.quantity).toFixed(2);
    tr.dataset.id = p.id; // Add data-id for event delegation

    tr.innerHTML = `
      <td>
        ${p.afbeelding
          ? `<img src="${p.afbeelding}" alt="${p.naam}" class="basket-thumbnail">`
          : '<div class="basket-thumbnail basket-placeholder"></div>'}
      </td>
      <td>${p.naam}</td>
      <td>${p.soort}</td>
      <td>€ ${Number(p.prijs).toFixed(2)}</td>
      <td><input type="number" class="basket-quantity-input" data-id="${p.id}" value="${p.quantity}" min="1" max="999"></td>
      <td class="basket-item-total">€ ${totalItemPrice}</td>
      <td><button class="remove-from-basket-btn" data-id="${p.id}" title="Verwijder uit mandje"><i class="fas fa-times-circle"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  // Calculate overall total price
  const overallTotalPrice = selectedPlantsWithDetails.reduce((sum, p) => sum + (Number(p.prijs) * p.quantity), 0);
  const totalDiv = document.createElement('div');
  totalDiv.classList.add('basket-overall-total');
  totalDiv.innerHTML = `<strong>Totaalprijs mandje: €${overallTotalPrice.toFixed(2)}</strong>`;
  basketContent.appendChild(totalDiv);

  // Add event listeners for quantity inputs and remove buttons
  basketContent.querySelectorAll('.basket-quantity-input').forEach(input => {
    input.addEventListener('change', updateBasketQuantity);
  });
  basketContent.querySelectorAll('.remove-from-basket-btn').forEach(button => {
    button.addEventListener('click', removeFromBasket);
  });

  exportBasketPdfButton.disabled = false; // Enable export button if there are items
  modal.style.display = 'flex';
}

function hideBasketModal() {
  document.getElementById('basket-modal').style.display = 'none';
}

function updateBasketQuantity(e) {
  const plantId = e.target.dataset.id;
  const newQuantity = parseInt(e.target.value, 10);

  const selectedItemIndex = geselecteerd.findIndex(item => item.id === plantId);
  if (selectedItemIndex !== -1) {
    geselecteerd[selectedItemIndex].quantity = newQuantity;
    save(); // Save updated quantity
    showBasketModal(); // Re-render basket to update total prices
    renderTable(document.getElementById('filter').value); // Also update main table to reflect selection status
  }
}

function removeFromBasket(e) {
  const plantId = e.target.closest('button').dataset.id;
  geselecteerd = geselecteerd.filter(item => item.id !== plantId);
  save(); // Save updated selection
  showBasketModal(); // Re-render basket
  renderTable(document.getElementById('filter').value); // Update main table checkbox and row highlight
}


document.getElementById('view-selection').addEventListener('click', showBasketModal);
document.getElementById('close-basket-modal').addEventListener('click', hideBasketModal);


// ----------- EXPORT BASKET TO PDF FUNCTIONALITY -----------
document.getElementById('export-basket-pdf').addEventListener('click', async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 15;
  const rightMargin = 15;
  const topMargin = 20;
  const bottomMargin = 30;
  const availableWidth = pageWidth - leftMargin - rightMargin;
  const availableHeight = pageHeight - topMargin - bottomMargin;
  const lineHeight = 7;

  let y = topMargin;

  // Header content for Basket PDF (similar to main PDF)
  doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
  doc.setFontSize(pdfSettings.fontSize + 8);
  doc.setTextColor(pdfSettings.titleColor);
  doc.text(`Mandje: ${pdfSettings.title}`, leftMargin, y); // Specific title for basket PDF

  doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
  doc.setFontSize(pdfSettings.fontSize);
  doc.setTextColor(50);
  doc.text(`Datum: ${pdfSettings.exportDate}`, pageWidth - rightMargin, y, { align: 'right' });
  y += 15;

  doc.setDrawColor(pdfSettings.titleColor);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, y, pageWidth - rightMargin, y);
  y += 10;

  const selectedPlantsWithDetails = geselecteerd.map(selectedItem => {
    const plantDetail = planten.find(p => p.id === selectedItem.id);
    return plantDetail ? { ...plantDetail, quantity: selectedItem.quantity } : null;
  }).filter(item => item !== null);

  if (selectedPlantsWithDetails.length === 0) {
    alert('Geen planten geselecteerd om te exporteren.');
    return;
  }

  const plantBlockMinHeightBasket = 100;
  const imageSizeBasket = 40;
  const textLeftOffsetBasket = leftMargin + imageSizeBasket + 10;

  let overallTotalPriceBasket = 0;

  for (let i = 0; i < selectedPlantsWithDetails.length; i++) {
    const p = selectedPlantsWithDetails[i];
    const itemTotalPrice = Number(p.prijs) * p.quantity;
    overallTotalPriceBasket += itemTotalPrice;

    let startYForBlock = y;

    // Check for new page before drawing block content
    if (y + plantBlockMinHeightBasket > pageHeight - bottomMargin) {
      await addPdfFooter(doc, doc.internal.getNumberOfPages(), selectedPlantsWithDetails.length); // Add footer to current page
      doc.addPage();
      y = topMargin;
      startYForBlock = y;
      // Redraw header on new page
      doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
      doc.setFontSize(pdfSettings.fontSize + 8);
      doc.setTextColor(pdfSettings.titleColor);
      doc.text(`Mandje: ${pdfSettings.title}`, leftMargin, y);

      doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
      doc.setFontSize(pdfSettings.fontSize);
      doc.setTextColor(50);
      doc.text(`Datum: ${pdfSettings.exportDate}`, pageWidth - rightMargin, y, { align: 'right' });
      y += 15;

      doc.setDrawColor(pdfSettings.titleColor);
      doc.setLineWidth(0.5);
      doc.line(leftMargin, y, pageWidth - rightMargin, y);
      y += 10;
    }

    // Plant Image
    if (p.afbeelding && pdfSettings.columns.includes("afbeelding")) {
      try {
        const img = new window.Image();
        img.src = p.afbeelding;
        await new Promise((resolve, reject) => {
          img.onload = () => {
            doc.addImage(p.afbeelding, 'JPEG', leftMargin, y, imageSizeBasket, imageSizeBasket);
            resolve();
          };
          img.onerror = (err) => {
            console.error("Fout bij het laden van plantafbeelding voor PDF:", err);
            resolve();
          };
        });
      } catch (err) {
        console.error("Fout bij het toevoegen van plantafbeelding aan PDF:", err);
      }
    }

    let currentYForText = y + (pdfSettings.fontSize / 2);

    // Plant Name
    doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
    doc.setFontSize(pdfSettings.fontSize + 4);
    doc.setTextColor(pdfSettings.titleColor);
    doc.text(p.naam, textLeftOffsetBasket, currentYForText);
    currentYForText += pdfSettings.fontSize + 5;

    // Botanical Name
    if (p.botanisch && pdfSettings.columns.includes("botanisch")) {
      doc.setFont(pdfSettings.fontFamily || "helvetica", "italic");
      doc.setFontSize(pdfSettings.fontSize);
      doc.setTextColor(80);
      doc.text(`(${p.botanisch})`, textLeftOffsetBasket, currentYForText);
      currentYForText += pdfSettings.fontSize + 5;
    }
    
    // Quantity, Soort and Prijs
    doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
    doc.setFontSize(pdfSettings.fontSize);
    doc.setTextColor(50);

    let basketDetailLine = [];
    if (p.quantity) {
        basketDetailLine.push(`Aantal: ${p.quantity}`);
    }
    if (p.soort && pdfSettings.columns.includes("soort")) {
      basketDetailLine.push(`Soort: ${p.soort}`);
    }
    if (p.prijs && pdfSettings.columns.includes("prijs")) {
      basketDetailLine.push(`Prijs per stuk: €${Number(p.prijs).toFixed(2)}`);
    }
    if (basketDetailLine.length > 0) {
      doc.text(basketDetailLine.join(' | '), textLeftOffsetBasket, currentYForText);
      currentYForText += lineHeight + 2;
    }
    
    // Total Price for this item
    doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
    doc.setFontSize(pdfSettings.fontSize);
    doc.setTextColor("#388e3c");
    doc.text(`Totaal: €${itemTotalPrice.toFixed(2)}`, textLeftOffsetBasket, currentYForText);
    currentYForText += lineHeight + 5;

    currentYForText = Math.max(currentYForText, y + imageSizeBasket + 5);

    // Omschrijving (Description)
    if (p.omschrijving && pdfSettings.columns.includes("omschrijving")) {
      doc.setFont(pdfSettings.fontFamily || "helvetica", "normal");
      doc.setFontSize(pdfSettings.fontSize - 1);
      doc.setTextColor(30);
      
      const descriptionTextWidth = availableWidth - (leftMargin + 5);
      
      let descriptionLines;
      if (p.afbeelding && pdfSettings.columns.includes("afbeelding")) {
          let linesNextToImage = doc.splitTextToSize(p.omschrijving, availableWidth - imageSizeBasket - 15);
          let currentDescriptionY = currentYForText;
          let remainingDescription = p.omschrijving;

          for (let line of linesNextToImage) {
              if (currentDescriptionY + lineHeight <= y + imageSizeBasket + 5) {
                  doc.text(line, textLeftOffsetBasket, currentDescriptionY);
                  currentDescriptionY += lineHeight;
                  remainingDescription = remainingDescription.substring(line.length).trim();
              } else {
                  break;
              }
          }
          if (remainingDescription.length > 0) {
              const fullWidthDescriptionLines = doc.splitTextToSize(remainingDescription, availableWidth);
              doc.text(fullWidthDescriptionLines, leftMargin, y + imageSizeBasket + 10);
              currentYForText = Math.max(currentYForText, y + imageSizeBasket + 10 + (fullWidthDescriptionLines.length * lineHeight));
          } else {
            currentYForText = Math.max(currentYForText, currentDescriptionY);
          }

      } else {
          descriptionLines = doc.splitTextToSize(p.omschrijving, availableWidth);
          doc.text(descriptionLines, leftMargin, currentYForText);
          currentYForText += descriptionLines.length * lineHeight;
      }
    }

    y = Math.max(y + plantBlockMinHeightBasket, currentYForText + 5);
    
    if (i < selectedPlantsWithDetails.length - 1) {
      doc.setDrawColor(pdfSettings.borderColor || 220);
      doc.setLineWidth(0.2);
      doc.line(leftMargin, y, pageWidth - rightMargin, y);
      y += 5;
    } else {
      y += 10;
    }
  }

  // Overall Total Price for Basket at the end
  if (y + 20 > pageHeight - bottomMargin) {
      await addPdfFooter(doc, doc.internal.getNumberOfPages(), selectedPlantsWithDetails.length);
      doc.addPage();
      y = topMargin;
  }
  doc.setFont(pdfSettings.fontFamily || "helvetica", "bold");
  doc.setFontSize(pdfSettings.fontSize + 4);
  doc.setTextColor("#388e3c");
  doc.text(`Totaalprijs Mandje: €${overallTotalPriceBasket.toFixed(2)}`, leftMargin, y + lineHeight);

  await addPdfFooter(doc, doc.internal.getNumberOfPages(), doc.internal.getNumberOfPages()); // Add footer to the last page

  doc.save('planten_mandje.pdf');
});

// ----------- PLANT DETAIL MODAL FUNCTIES -----------
function showPlantDetailModal(plant) {
  const modal = document.getElementById('plant-detail-modal');
  const title = document.getElementById('plant-detail-modal-title');
  const content = document.getElementById('plant-detail-content');

  title.textContent = plant.naam;
  let htmlContent = '';
  if (plant.afbeelding) {
    htmlContent += `<img src="${plant.afbeelding}" alt="${plant.naam}">`;
  } else {
    htmlContent += '<div class="basket-thumbnail basket-placeholder" style="width: 100%; height: 150px; margin-bottom: 15px;">Geen afbeelding</div>';
  }
  htmlContent += `<p><strong>Botanische naam:</strong> ${plant.botanisch || 'N.v.t.'}</p>`;
  htmlContent += `<p><strong>Soort:</strong> ${plant.soort || 'N.v.t.'}</p>`;
  htmlContent += `<p><strong>Prijs:</strong> €${Number(plant.prijs).toFixed(2)}</p>`;
  htmlContent += `<p><strong>Omschrijving:</strong></p><p>${plant.omschrijving || 'Geen omschrijving beschikbaar.'}</p>`;
  
  content.innerHTML = htmlContent;
  modal.style.display = 'flex';
}

function hidePlantDetailModal() {
  document.getElementById('plant-detail-modal').style.display = 'none';
}

document.getElementById('close-plant-detail-modal').addEventListener('click', hidePlantDetailModal);
document.getElementById('close-plant-detail-button').addEventListener('click', hidePlantDetailModal);


window.addEventListener('load', () => {
  loadPDFSettings();
  console.log("PAGINA GELADEN: Instellingen worden opgehaald uit de lokale opslag."); // DEBUG: Toon dat de pagina laadt
  console.log("PDF instellingen geladen:", pdfSettings); // DEBUG: Toon de geladen instellingen
  renderTable();
});