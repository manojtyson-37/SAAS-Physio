export type StarterTest = {
  name: string; category: string; sampleType: string; unit?: string;
  refLow?: number; refHigh?: number; refText?: string; price: number;
};

/** Common adult reference ranges; clinics should confirm against their own lab's ranges. Prices are in rupees. */
export const STARTER_TESTS: StarterTest[] = [
  { name: "Hemoglobin (Hb)", category: "Hematology", sampleType: "Blood (EDTA)", unit: "g/dL", refLow: 12, refHigh: 17, price: 80 },
  { name: "Total WBC Count", category: "Hematology", sampleType: "Blood (EDTA)", unit: "cells/cumm", refLow: 4000, refHigh: 11000, price: 100 },
  { name: "Platelet Count", category: "Hematology", sampleType: "Blood (EDTA)", unit: "lakh/cumm", refLow: 1.5, refHigh: 4.5, price: 100 },
  { name: "RBC Count", category: "Hematology", sampleType: "Blood (EDTA)", unit: "million/cumm", refLow: 4.2, refHigh: 6.1, price: 100 },
  { name: "Hematocrit (PCV)", category: "Hematology", sampleType: "Blood (EDTA)", unit: "%", refLow: 36, refHigh: 52, price: 80 },
  { name: "ESR", category: "Hematology", sampleType: "Blood (EDTA)", unit: "mm/hr", refLow: 0, refHigh: 20, price: 80 },
  { name: "Blood Glucose Fasting", category: "Biochemistry", sampleType: "Serum", unit: "mg/dL", refLow: 70, refHigh: 100, price: 60 },
  { name: "Blood Glucose Post Prandial", category: "Biochemistry", sampleType: "Serum", unit: "mg/dL", refLow: 70, refHigh: 140, price: 60 },
  { name: "HbA1c", category: "Biochemistry", sampleType: "Blood (EDTA)", unit: "%", refLow: 4, refHigh: 5.6, price: 450 },
  { name: "Serum Creatinine", category: "Biochemistry", sampleType: "Serum", unit: "mg/dL", refLow: 0.6, refHigh: 1.3, price: 120 },
  { name: "Blood Urea", category: "Biochemistry", sampleType: "Serum", unit: "mg/dL", refLow: 15, refHigh: 45, price: 100 },
  { name: "Serum Uric Acid", category: "Biochemistry", sampleType: "Serum", unit: "mg/dL", refLow: 3.5, refHigh: 7.2, price: 120 },
  { name: "Serum Calcium", category: "Biochemistry", sampleType: "Serum", unit: "mg/dL", refLow: 8.5, refHigh: 10.5, price: 150 },
  { name: "Vitamin D (25-OH)", category: "Biochemistry", sampleType: "Serum", unit: "ng/mL", refLow: 30, refHigh: 100, price: 900 },
  { name: "Total Cholesterol", category: "Lipid profile", sampleType: "Serum", unit: "mg/dL", refHigh: 200, price: 120 },
  { name: "HDL Cholesterol", category: "Lipid profile", sampleType: "Serum", unit: "mg/dL", refLow: 40, price: 120 },
  { name: "LDL Cholesterol", category: "Lipid profile", sampleType: "Serum", unit: "mg/dL", refHigh: 100, price: 120 },
  { name: "Triglycerides", category: "Lipid profile", sampleType: "Serum", unit: "mg/dL", refHigh: 150, price: 120 },
  { name: "Total Bilirubin", category: "Liver function", sampleType: "Serum", unit: "mg/dL", refLow: 0.2, refHigh: 1.2, price: 100 },
  { name: "SGOT (AST)", category: "Liver function", sampleType: "Serum", unit: "U/L", refLow: 5, refHigh: 40, price: 100 },
  { name: "SGPT (ALT)", category: "Liver function", sampleType: "Serum", unit: "U/L", refLow: 5, refHigh: 40, price: 100 },
  { name: "Alkaline Phosphatase (ALP)", category: "Liver function", sampleType: "Serum", unit: "U/L", refLow: 44, refHigh: 147, price: 100 },
  { name: "Total Protein", category: "Liver function", sampleType: "Serum", unit: "g/dL", refLow: 6, refHigh: 8.3, price: 100 },
  { name: "Serum Albumin", category: "Liver function", sampleType: "Serum", unit: "g/dL", refLow: 3.5, refHigh: 5.2, price: 100 },
  { name: "TSH", category: "Thyroid", sampleType: "Serum", unit: "uIU/mL", refLow: 0.4, refHigh: 4.2, price: 300 },
  { name: "CRP (C-Reactive Protein)", category: "Inflammation", sampleType: "Serum", unit: "mg/L", refHigh: 6, price: 400 },
  { name: "Rheumatoid Factor (RA)", category: "Inflammation", sampleType: "Serum", unit: "IU/mL", refHigh: 14, price: 350 },
  { name: "Urine Colour", category: "Urine routine", sampleType: "Urine", refText: "Pale yellow", price: 30 },
  { name: "Urine Protein (Albumin)", category: "Urine routine", sampleType: "Urine", refText: "Nil", price: 30 },
  { name: "Urine Sugar", category: "Urine routine", sampleType: "Urine", refText: "Nil", price: 30 },
  { name: "Urine Pus Cells", category: "Urine routine", sampleType: "Urine", unit: "/hpf", refLow: 0, refHigh: 5, price: 30 },
  { name: "Urine Epithelial Cells", category: "Urine routine", sampleType: "Urine", unit: "/hpf", refLow: 0, refHigh: 5, price: 30 },
];
