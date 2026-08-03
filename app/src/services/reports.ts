// Modified by AI on 07/18/2026. Edit #1.
// 402 responses mean tax-ready exports are gated behind a paid plan.
import { API_BASE_URL, getAccessToken } from './api';
import * as FileSystem from 'expo-file-system/legacy';

export async function downloadScheduleEPdf(organizationId: string, year: number): Promise<string> {
  const token = getAccessToken();
  const url = `${API_BASE_URL}/reports/schedule-e?organization_id=${organizationId}&year=${year}`;
  const filename = `Schedule_E_Summary_${year}.pdf`;
  const fileUri = `${FileSystem.documentDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(url, fileUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (result.status === 402) {
    throw new Error('EXPORTS_REQUIRE_UPGRADE');
  }
  if (result.status !== 200) {
    throw new Error(`Failed to download Schedule E PDF (status ${result.status})`);
  }

  return result.uri;
}

export async function downloadPropertyExpensePdf(
  organizationId: string,
  year: number,
  propertyId?: string,
): Promise<string> {
  const token = getAccessToken();
  let url = `${API_BASE_URL}/reports/property-expense?organization_id=${organizationId}&year=${year}`;
  if (propertyId) {
    url += `&property_id=${propertyId}`;
  }
  const filename = `Property_Expense_Summary_${year}.pdf`;
  const fileUri = `${FileSystem.documentDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(url, fileUri, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (result.status === 402) {
    throw new Error('EXPORTS_REQUIRE_UPGRADE');
  }
  if (result.status !== 200) {
    throw new Error(`Failed to download Property Expense PDF (status ${result.status})`);
  }

  return result.uri;
}
