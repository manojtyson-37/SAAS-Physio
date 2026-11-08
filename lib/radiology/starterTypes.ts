export type StarterType = { modality: "XRAY" | "ULTRASOUND" | "CT" | "MRI" | "ECG"; name: string; bodyPart: string; price: number };

/** Typical walk-in prices in rupees; clinics edit these after adding. */
export const STARTER_TYPES: StarterType[] = [
  { modality: "XRAY", name: "X-ray Chest PA", bodyPart: "Chest", price: 400 },
  { modality: "XRAY", name: "X-ray Cervical Spine", bodyPart: "Cervical spine", price: 500 },
  { modality: "XRAY", name: "X-ray Lumbosacral Spine", bodyPart: "Lumbosacral spine", price: 600 },
  { modality: "XRAY", name: "X-ray Knee AP/Lateral", bodyPart: "Knee", price: 500 },
  { modality: "XRAY", name: "X-ray Shoulder", bodyPart: "Shoulder", price: 500 },
  { modality: "XRAY", name: "X-ray Hip", bodyPart: "Hip", price: 500 },
  { modality: "XRAY", name: "X-ray Ankle", bodyPart: "Ankle", price: 450 },
  { modality: "XRAY", name: "X-ray Hand / Wrist", bodyPart: "Wrist", price: 450 },
  { modality: "XRAY", name: "OPG (Dental panoramic)", bodyPart: "Jaws", price: 600 },
  { modality: "XRAY", name: "IOPA (Dental)", bodyPart: "Tooth", price: 150 },
  { modality: "ULTRASOUND", name: "USG Abdomen", bodyPart: "Abdomen", price: 900 },
  { modality: "ULTRASOUND", name: "USG Pelvis", bodyPart: "Pelvis", price: 900 },
  { modality: "ULTRASOUND", name: "USG Whole Abdomen and Pelvis", bodyPart: "Abdomen and pelvis", price: 1400 },
  { modality: "CT", name: "CT Head (plain)", bodyPart: "Head", price: 3000 },
  { modality: "MRI", name: "MRI Knee", bodyPart: "Knee", price: 6000 },
  { modality: "MRI", name: "MRI Lumbosacral Spine", bodyPart: "Lumbosacral spine", price: 6500 },
  { modality: "MRI", name: "MRI Cervical Spine", bodyPart: "Cervical spine", price: 6500 },
  { modality: "ECG", name: "ECG (12 lead)", bodyPart: "Heart", price: 250 },
];
