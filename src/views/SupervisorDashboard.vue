<template>
  <ion-page>
    <AppHeader subtitle="Supervisor dashboard" />

    <ion-content :fullscreen="true" class="dashboard-content" style="--background: transparent">
      <!-- Fixed Background Layer (Subway platform na may dark vignette) -->
      <div class="fixed inset-0 bg-[#020611] -z-10 overflow-hidden flex items-center justify-center pointer-events-none select-none">
        <img
          src="/assets/bg-placeholder.png"
          alt="Platform Background"
          class="w-full h-full object-cover object-center brightness-[0.70] contrast-[1.15]"
        />
        <div class="absolute inset-0 bg-gradient-to-b from-[#020611]/60 via-[#020611]/30 to-[#020611]/90"></div>
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,194,255,0.12)_0%,transparent_60%)]"></div>
      </div>

      <!-- Pull to Refresh -->
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Main Responsive Container -->
      <div class="mx-auto max-w-6xl space-y-6 px-3.5 sm:px-6 py-6 font-aileron selection:bg-[#00C2FF] selection:text-black">
        
        <!-- Custom Cyber Segment Tabs -->
        <div class="trainext-glass-card p-1.5 flex items-center gap-1.5">
          <button
            type="button"
            class="tab-nav-btn"
            :class="activeTab === 'progress' ? 'tab-nav-btn-active' : ''"
            @click="activeTab = 'progress'"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Intern Progress
          </button>

          <button
            type="button"
            class="tab-nav-btn"
            :class="activeTab === 'sites' ? 'tab-nav-btn-active' : ''"
            @click="activeTab = 'sites'"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Site Geofences
          </button>

          <button
            type="button"
            class="tab-nav-btn"
            :class="activeTab === 'reviews' ? 'tab-nav-btn-active' : ''"
            @click="activeTab = 'reviews'"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Approvals
            <span v-if="supervisor.totalPending" class="badge-counter ml-2">
              {{ supervisor.totalPending }}
            </span>
          </button>
        </div>

        <!-- ======================= TAB 1: INTERN PROGRESS ======================= -->
        <template v-if="activeTab === 'progress'">
          <!-- 5-Metric Quick Stats Grid -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div class="stat-tile">
              <p class="stat-label">Assigned Interns</p>
              <p class="stat-value text-white">{{ supervisor.assignedInterns.length }}</p>
            </div>
            <div class="stat-tile">
              <p class="stat-label">Pending Reviews</p>
              <p class="stat-value text-amber-400">{{ supervisor.totalPending }}</p>
            </div>
            <div class="stat-tile">
              <p class="stat-label">Deployment Checks</p>
              <p class="stat-value text-[#00C2FF]">{{ supervisor.pendingDeploymentCount }}</p>
            </div>
            <div class="stat-tile">
              <p class="stat-label">Company Sites</p>
              <p class="stat-value text-white">{{ ownedSites.length }}</p>
            </div>
            <div class="stat-tile col-span-2 sm:col-span-1">
              <p class="stat-label">Approved Hours</p>
              <p class="stat-value text-emerald-400">{{ totalApprovedHours }}</p>
            </div>
          </div>

          <!-- Section Banner -->
          <div class="trainext-glass-card">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h3 class="card-title text-white">Intern OJT Progress</h3>
                <p class="card-subtitle text-slate-400">
                  Assign a company site and required hours, then monitor approved attendance against the curriculum requirement.
                </p>
              </div>
            </div>

            <p v-if="!supervisor.visibleInterns.length" class="text-center py-8 text-xs text-slate-400 font-regular">
              No intern accounts have registered yet.
            </p>
          </div>

          <!-- Intern Cards Grid -->
          <div class="grid gap-4 md:grid-cols-2">
            <InternAssignmentCard
              v-for="intern in supervisor.visibleInterns"
              :key="intern.intern_id"
              :intern="intern"
              :sites="ownedSites"
              @assigned="showToast"
            />
          </div>
        </template>

        <!-- ======================= TAB 2: SITE GEOFENCES ======================= -->
        <template v-if="activeTab === 'sites'">
          <!-- Site Config Form Card -->
          <div class="trainext-glass-card">
            <div class="flex items-center justify-between gap-3 mb-5">
              <div class="flex items-center gap-3">
                <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 class="card-title text-white">
                    {{ editingSiteId ? 'Edit Company Site' : 'Create Company Site' }}
                  </h3>
                  <p class="card-subtitle text-slate-400">
                    Tap the map to position the geofence center. The radius determines where interns can punch clock-in.
                  </p>
                </div>
              </div>
            </div>

            <form @submit.prevent="saveSite" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="field-label">SITE NAME</label>
                  <div class="input-line-box">
                    <input
                      v-model="siteForm.name"
                      type="text"
                      placeholder="e.g., Head Office / Branch A"
                      class="field-input"
                    />
                  </div>
                </div>

                <div>
                  <label class="field-label">OFFICE / SITE ADDRESS</label>
                  <div class="input-line-box">
                    <input
                      v-model="siteForm.address"
                      type="text"
                      placeholder="123 Example Street, City"
                      class="field-input"
                    />
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="field-label">LATITUDE</label>
                  <div class="input-line-box">
                    <input
                      v-model="siteForm.latitude"
                      type="number"
                      step="0.0000001"
                      placeholder="14.5995000"
                      class="field-input"
                    />
                  </div>
                </div>

                <div>
                  <label class="field-label">LONGITUDE</label>
                  <div class="input-line-box">
                    <input
                      v-model="siteForm.longitude"
                      type="number"
                      step="0.0000001"
                      placeholder="120.9842000"
                      class="field-input"
                    />
                  </div>
                </div>

                <div>
                  <label class="field-label">GEOFENCE RADIUS (METERS)</label>
                  <div class="input-line-box">
                    <input
                      v-model="siteForm.radius_meters"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="120"
                      class="field-input"
                    />
                  </div>
                </div>
              </div>

              <!-- Active Site Toggle Button -->
              <div class="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/10">
                <div>
                  <p class="text-xs font-heavy uppercase text-white tracking-wider">Site Activation Status</p>
                  <p class="text-[11px] text-slate-400">Controls whether interns are authorized to clock in at this site</p>
                </div>
                <button
                  type="button"
                  class="toggle-switch"
                  :class="siteForm.is_active ? 'toggle-switch-active' : ''"
                  @click="siteForm.is_active = !siteForm.is_active"
                >
                  <span class="toggle-switch-thumb"></span>
                </button>
              </div>

              <!-- Location Picker Helpers -->
              <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  class="pill-btn-outline flex items-center gap-2"
                  :disabled="geoLoading"
                  @click="useCurrentLocation"
                >
                  <ion-spinner v-if="geoLoading" name="crescent" class="w-3.5 h-3.5 text-[#00C2FF]" />
                  <svg v-else class="w-4 h-4 text-[#00C2FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                  </svg>
                  Use my current location
                </button>

                <p v-if="siteFeedback" class="text-xs font-semibold" :class="siteFeedbackColor === 'success' ? 'text-emerald-400' : 'text-rose-400'">
                  {{ siteFeedback }}
                </p>
              </div>

              <!-- Interactive Map -->
              <div class="rounded-2xl overflow-hidden border border-white/20 shadow-inner mt-4">
                <SitePickerMap
                  :latitude="pickerLatitude"
                  :longitude="pickerLongitude"
                  :radius-meters="pickerRadius"
                  height="320px"
                  @update:latitude="siteForm.latitude = String($event)"
                  @update:longitude="siteForm.longitude = String($event)"
                />
              </div>

              <!-- Form Action Buttons -->
              <div class="mt-4 flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  class="pill-btn btn-gradient-cyan flex items-center justify-center gap-2"
                  :disabled="savingSite"
                >
                  <ion-spinner v-if="savingSite" name="crescent" class="w-4 h-4 text-black" />
                  {{ editingSiteId ? 'SAVE CHANGES' : 'CREATE SITE' }}
                </button>
                <button
                  v-if="editingSiteId"
                  type="button"
                  class="pill-btn-outline"
                  @click="resetSiteForm"
                >
                  Cancel Edit
                </button>
              </div>
            </form>
          </div>

          <!-- Configured Sites List Card -->
          <div class="trainext-glass-card">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 class="card-title text-white">Configured Sites</h3>
                <p class="card-subtitle text-slate-400">{{ ownedSites.length }} site(s) under your supervision</p>
              </div>
            </div>

            <p v-if="!ownedSites.length" class="text-center py-8 text-xs text-slate-400 font-regular">
              No company sites configured yet.
            </p>

            <div v-else class="space-y-3">
              <div
                v-for="site in ownedSites"
                :key="site.id"
                class="history-row flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-heavy text-white">{{ site.name }}</h4>
                    <span
                      class="badge-pill text-[10px]"
                      :class="site.is_active ? 'badge-pill-success' : 'badge-pill-slate'"
                    >
                      {{ site.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-300 mt-0.5 font-regular">{{ site.address || 'No address provided' }}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">
                    Coords: {{ site.latitude.toFixed(5) }}, {{ site.longitude.toFixed(5) }} · 
                    <strong class="text-[#00C2FF]">{{ site.radius_meters.toFixed(1) }}m radius</strong>
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    class="pill-btn-sm"
                    @click="startEditingSite(site)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="pill-btn-danger-sm"
                    @click="confirmDeleteSite(site)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- ======================= TAB 3: APPROVALS & REVIEWS ======================= -->
        <template v-if="activeTab === 'reviews'">
          <!-- Batch Operations Controller Card -->
          <div class="trainext-glass-card">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div class="flex items-center gap-3">
                <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 class="card-title text-white">Batch Approvals</h3>
                  <p class="card-subtitle text-slate-400">
                    {{ filteredPendingLogs.length }} log(s) · {{ filteredPendingReports.length }} report(s) in {{ cadenceLabel }}
                  </p>
                </div>
              </div>

              <!-- Cadence Filters -->
              <div class="flex items-center p-1 rounded-full bg-slate-900/60 border border-white/10">
                <button
                  type="button"
                  class="filter-pill"
                  :class="cadence === 'daily' ? 'filter-pill-active' : ''"
                  @click="cadence = 'daily'"
                >
                  Daily
                </button>
                <button
                  type="button"
                  class="filter-pill"
                  :class="cadence === 'weekly' ? 'filter-pill-active' : ''"
                  @click="cadence = 'weekly'"
                >
                  Weekly
                </button>
                <button
                  type="button"
                  class="filter-pill"
                  :class="cadence === 'monthly' ? 'filter-pill-active' : ''"
                  @click="cadence = 'monthly'"
                >
                  Monthly
                </button>
              </div>
            </div>

            <!-- Batch Selection Row -->
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <button type="button" class="pill-btn-outline" @click="selectAllVisible">
                Select all visible
              </button>
              <button type="button" class="pill-btn-outline" @click="clearSelection">
                Clear selection
              </button>
              <span class="badge-pill badge-pill-cyan">
                {{ selectedCount }} selected
              </span>
            </div>

            <!-- Global Remarks -->
            <div class="mb-4">
              <label class="field-label">BATCH REMARKS (SENT TO EVERY SELECTED INTERN)</label>
              <div class="textarea-box">
                <textarea
                  v-model="batchFeedback"
                  rows="2"
                  placeholder="Optional remarks applied to this batch review..."
                  class="field-textarea"
                ></textarea>
              </div>
            </div>

            <!-- Dual Execution Actions -->
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <p class="text-xs font-heavy tracking-wider uppercase text-slate-200">
                  Accomplishment Reports ({{ selectedReportIds.length }} selected)
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="pill-btn btn-gradient-cyan text-xs py-2 px-4"
                    :disabled="!selectedReportIds.length || reviewingBatch"
                    @click="batchReviewReports('approved')"
                  >
                    Approve selected
                  </button>
                  <button
                    type="button"
                    class="pill-btn-danger-sm py-2 px-4"
                    :disabled="!selectedReportIds.length || reviewingBatch"
                    @click="batchReviewReports('rejected')"
                  >
                    Reject selected
                  </button>
                </div>
              </div>

              <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <p class="text-xs font-heavy tracking-wider uppercase text-slate-200">
                  Attendance Logs ({{ selectedLogIds.length }} selected)
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="pill-btn btn-gradient-cyan text-xs py-2 px-4"
                    :disabled="!selectedLogIds.length || reviewingBatch"
                    @click="batchReviewLogs('approved')"
                  >
                    Approve selected
                  </button>
                  <button
                    type="button"
                    class="pill-btn-danger-sm py-2 px-4"
                    :disabled="!selectedLogIds.length || reviewingBatch"
                    @click="batchReviewLogs('rejected')"
                  >
                    Reject selected
                  </button>
                </div>
              </div>
            </div>

            <div v-if="reviewingBatch" class="mt-4 flex items-center gap-2 text-xs text-[#00C2FF] font-bold">
              <ion-spinner name="crescent" class="w-4 h-4 text-[#00C2FF]" />
              Processing batch approvals…
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-if="!filteredPendingLogs.length && !filteredPendingReports.length"
            class="trainext-glass-card text-center py-10"
          >
            <p class="text-xs text-slate-400 font-regular">
              No pending attendance logs or accomplishment reports in this period.
            </p>
          </div>

          <!-- Pending Attendance Review Cards -->
          <div
            v-for="log in filteredPendingLogs"
            :key="log.id"
            class="trainext-glass-card"
          >
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="text-base font-heavy text-white">{{ internName(log.intern_id) }}</h3>
                <p class="card-subtitle text-[#00C2FF]">Attendance · {{ formatDateTime(log.clock_in_at) }}</p>
              </div>
              <label class="custom-checkbox-container">
                <input
                  type="checkbox"
                  :checked="selectedLogIds.includes(log.id)"
                  @change="toggleLog(log.id)"
                />
                <span class="custom-checkbox-checkmark"></span>
              </label>
            </div>

            <!-- Log Details Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/10 text-xs">
              <div>
                <span class="text-[10px] text-slate-400 block uppercase font-bold">Clock in</span>
                <strong class="text-white">{{ formatTime(log.clock_in_at) }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block uppercase font-bold">Clock out</span>
                <strong class="text-white">{{ log.clock_out_at ? formatTime(log.clock_out_at) : '—' }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block uppercase font-bold">Hours Rendered</span>
                <strong class="text-[#00C2FF]">{{ Number(log.hours_rendered).toFixed(2) }}</strong>
              </div>
              <div>
                <span class="text-[10px] text-slate-400 block uppercase font-bold">GPS Coordinates</span>
                <span class="text-slate-300 font-mono">{{ log.clock_in_latitude.toFixed(4) }}, {{ log.clock_in_longitude.toFixed(4) }}</span>
              </div>
            </div>

            <!-- Feedback to Intern -->
            <div class="mt-3">
              <label class="field-label">FEEDBACK TO INTERN (INCLUDED IN EMAIL)</label>
              <div class="textarea-box">
                <textarea
                  v-model="logFeedback[log.id]"
                  rows="2"
                  placeholder="Optional remarks for approval or rejection..."
                  class="field-textarea"
                ></textarea>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="pill-btn btn-gradient-cyan text-xs py-2 px-4 flex items-center gap-1.5"
                :disabled="reviewingLogId === log.id"
                @click="reviewLog(log, 'approved')"
              >
                <ion-spinner v-if="reviewingLogId === log.id" name="crescent" class="w-3.5 h-3.5 text-black" />
                Approve Log
              </button>
              <button
                type="button"
                class="pill-btn-danger-sm py-2 px-4"
                :disabled="reviewingLogId === log.id"
                @click="reviewLog(log, 'rejected')"
              >
                Reject Log
              </button>
            </div>
          </div>

          <!-- Pending Report Review Cards -->
          <div
            v-for="report in filteredPendingReports"
            :key="report.id"
            class="trainext-glass-card"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <h3 class="text-base font-heavy text-white">{{ report.title }}</h3>
                <p class="card-subtitle text-[#00C2FF]">
                  {{ internName(report.intern_id) }} · {{ formatDate(report.report_date) }}
                </p>
              </div>
              <label class="custom-checkbox-container">
                <input
                  type="checkbox"
                  :checked="selectedReportIds.includes(report.id)"
                  @change="toggleReport(report.id)"
                />
                <span class="custom-checkbox-checkmark"></span>
              </label>
            </div>

            <p class="text-xs text-slate-200 mt-2 whitespace-pre-line font-regular leading-relaxed p-3 rounded-2xl bg-white/[0.02] border border-white/10">
              {{ report.tasks }}
            </p>

            <div class="mt-3 flex items-center justify-between">
              <p class="text-xs text-slate-300">
                <strong class="text-white">Hours spent:</strong> {{ Number(report.hours_spent).toFixed(2) }}
              </p>
              <div v-if="report.proofs?.length" class="flex flex-wrap gap-1.5">
                <span
                  v-for="proof in report.proofs"
                  :key="proof.id"
                  class="badge-pill badge-pill-cyan text-[10px] cursor-pointer"
                  @click="openProofs(report)"
                >
                  📎 {{ proof.kind }}
                </span>
                <button
                  type="button"
                  class="pill-btn-sm text-[10px] py-1 px-2.5"
                  @click="openProofs(report)"
                >
                  View Proofs
                </button>
              </div>
            </div>

            <!-- Feedback to Intern -->
            <div class="mt-3">
              <label class="field-label">FEEDBACK TO INTERN (INCLUDED IN EMAIL)</label>
              <div class="textarea-box">
                <textarea
                  v-model="reportFeedback[report.id]"
                  rows="2"
                  placeholder="Optional remarks for approval or rejection..."
                  class="field-textarea"
                ></textarea>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="pill-btn btn-gradient-cyan text-xs py-2 px-4 flex items-center gap-1.5"
                :disabled="reviewingReportId === report.id"
                @click="reviewReport(report, 'approved')"
              >
                <ion-spinner v-if="reviewingReportId === report.id" name="crescent" class="w-3.5 h-3.5 text-black" />
                Approve Report
              </button>
              <button
                type="button"
                class="pill-btn-danger-sm py-2 px-4"
                :disabled="reviewingReportId === report.id"
                @click="reviewReport(report, 'rejected')"
              >
                Reject Report
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Modals and Toasts -->
      <ProofViewerModal
        :is-open="viewerOpen"
        :report="viewerReport"
        @update:is-open="viewerOpen = $event"
      />

      <ion-toast
        :is-open="toast.open"
        :message="toast.message"
        :color="toast.color"
        :duration="5000"
        @ionDidDismiss="toast.open = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonToast,
  alertController
} from '@ionic/vue'
import AppHeader from '@/components/AppHeader.vue'
import SitePickerMap from '@/components/SitePickerMap.vue'
import InternAssignmentCard from '@/components/InternAssignmentCard.vue'
import ProofViewerModal from '@/components/ProofViewerModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useSitesStore } from '@/stores/sites'
import { useSupervisorStore } from '@/stores/supervisor'
import { useGeolocation } from '@/composables/useGeolocation'
import type {
  AccomplishmentReport,
  ApprovalCadence,
  ApprovalStatus,
  AttendanceLog,
  CompanySite,
  SiteInput
} from '@/types'

type TabName = 'progress' | 'sites' | 'reviews'
type ReviewStatus = Exclude<ApprovalStatus, 'pending'>

interface SiteFormState {
  name: string
  address: string
  latitude: string
  longitude: string
  radius_meters: string
  is_active: boolean
}

const auth = useAuthStore()
const sitesStore = useSitesStore()
const supervisor = useSupervisorStore()
const {
  refresh: refreshLocation,
  isLoading: geoLoading
} = useGeolocation()

const activeTab = ref<TabName>('progress')
const editingSiteId = ref<string | null>(null)
const savingSite = ref(false)
const siteFeedback = ref('')
const siteFeedbackColor = ref<'success' | 'danger'>('success')
const reviewingLogId = ref('')
const reviewingReportId = ref('')
const reviewingBatch = ref(false)
const cadence = ref<ApprovalCadence>('daily')
const batchFeedback = ref('')
const selectedLogIds = ref<string[]>([])
const selectedReportIds = ref<string[]>([])
const viewerOpen = ref(false)
const viewerReport = ref<AccomplishmentReport | null>(null)
const logFeedback = reactive<Record<string, string>>({})
const reportFeedback = reactive<Record<string, string>>({})
const toast = reactive({
  open: false,
  message: '',
  color: 'success'
})

const siteForm = reactive<SiteFormState>({
  name: '',
  address: '',
  latitude: '14.5995000',
  longitude: '120.9842000',
  radius_meters: '120',
  is_active: true
})

const ownedSites = computed(() =>
  sitesStore.sites.filter((site) => site.supervisor_id === auth.profile?.id)
)

const pickerLatitude = computed(() => {
  const value = Number(siteForm.latitude)
  return Number.isFinite(value) ? value : 0
})
const pickerLongitude = computed(() => {
  const value = Number(siteForm.longitude)
  return Number.isFinite(value) ? value : 0
})
const pickerRadius = computed(() => {
  const value = Number(siteForm.radius_meters)
  return Number.isFinite(value) && value > 0 ? value : 1
})

const totalApprovedHours = computed(() =>
  supervisor.assignedInterns
    .reduce((total, intern) => total + Number(intern.approved_hours || 0), 0)
    .toFixed(2)
)

const cadenceStart = computed(() => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  if (cadence.value === 'weekly') {
    date.setDate(date.getDate() - 6)
  } else if (cadence.value === 'monthly') {
    date.setDate(1)
  }
  return date
})

const cadenceLabel = computed(() => {
  if (cadence.value === 'weekly') {
    return 'the last 7 days'
  }
  if (cadence.value === 'monthly') {
    return 'the current month'
  }
  return 'today'
})

const filteredPendingLogs = computed(() =>
  supervisor.pendingLogs.filter(
    (log) => new Date(log.clock_in_at) >= cadenceStart.value
  )
)

const filteredPendingReports = computed(() =>
  supervisor.pendingReports.filter(
    (report) => new Date(`${report.report_date}T00:00:00`) >= cadenceStart.value
  )
)

const selectedCount = computed(
  () => selectedLogIds.value.length + selectedReportIds.value.length
)

function internName(internId: string): string {
  return supervisor.internById(internId)?.full_name ?? 'Intern'
}

function toggleLog(id: string): void {
  selectedLogIds.value = selectedLogIds.value.includes(id)
    ? selectedLogIds.value.filter((item) => item !== id)
    : [...selectedLogIds.value, id]
}

function toggleReport(id: string): void {
  selectedReportIds.value = selectedReportIds.value.includes(id)
    ? selectedReportIds.value.filter((item) => item !== id)
    : [...selectedReportIds.value, id]
}

function selectAllVisible(): void {
  selectedLogIds.value = filteredPendingLogs.value.map((log) => log.id)
  selectedReportIds.value = filteredPendingReports.value.map(
    (report) => report.id
  )
}

function clearSelection(): void {
  selectedLogIds.value = []
  selectedReportIds.value = []
}

watch(cadence, clearSelection)

function openProofs(report: AccomplishmentReport): void {
  viewerReport.value = report
  viewerOpen.value = true
}

function formatDate(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDateTime(value: string): string {
  return `${formatDate(value)} at ${formatTime(value)}`
}

function showToast(message: string, color = 'success'): void {
  toast.message = message
  toast.color = color
  toast.open = true
}

async function loadData(): Promise<void> {
  await Promise.all([sitesStore.fetchSites(), supervisor.fetchDashboard()])
}

async function handleRefresh(event: CustomEvent): Promise<void> {
  try {
    await loadData()
  } finally {
    (event.target as HTMLIonRefresherElement).complete()
  }
}

function resetSiteForm(): void {
  editingSiteId.value = null
  siteForm.name = ''
  siteForm.address = ''
  siteForm.latitude = '14.5995000'
  siteForm.longitude = '120.9842000'
  siteForm.radius_meters = '120'
  siteForm.is_active = true
  siteFeedback.value = ''
}

function startEditingSite(site: CompanySite): void {
  editingSiteId.value = site.id
  siteForm.name = site.name
  siteForm.address = site.address
  siteForm.latitude = String(site.latitude)
  siteForm.longitude = String(site.longitude)
  siteForm.radius_meters = String(site.radius_meters)
  siteForm.is_active = site.is_active
  siteFeedback.value = ''
  activeTab.value = 'sites'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function useCurrentLocation(): Promise<void> {
  try {
    const location = await refreshLocation()
    siteForm.latitude = location.latitude.toFixed(7)
    siteForm.longitude = location.longitude.toFixed(7)
    siteFeedbackColor.value = 'success'
    siteFeedback.value = 'Coordinates updated from your current location.'
  } catch (err) {
    siteFeedbackColor.value = 'danger'
    siteFeedback.value =
      err instanceof Error ? err.message : 'Unable to read your location.'
  }
}

async function saveSite(): Promise<void> {
  siteFeedback.value = ''
  const latitude = Number(siteForm.latitude)
  const longitude = Number(siteForm.longitude)
  const radius = Number(siteForm.radius_meters)

  if (!siteForm.name.trim()) {
    siteFeedbackColor.value = 'danger'
    siteFeedback.value = 'Site name is required.'
    return
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    siteFeedbackColor.value = 'danger'
    siteFeedback.value = 'Latitude must be between -90 and 90.'
    return
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    siteFeedbackColor.value = 'danger'
    siteFeedback.value = 'Longitude must be between -180 and 180.'
    return
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    siteFeedbackColor.value = 'danger'
    siteFeedback.value = 'Radius must be greater than zero.'
    return
  }

  const input: SiteInput = {
    name: siteForm.name.trim(),
    address: siteForm.address.trim(),
    latitude,
    longitude,
    radius_meters: radius,
    is_active: siteForm.is_active
  }

  savingSite.value = true

  try {
    if (editingSiteId.value) {
      await sitesStore.updateSite(editingSiteId.value, input)
      showToast('Company site updated.', 'success')
    } else {
      await sitesStore.createSite(input)
      showToast('Company site created.', 'success')
    }
    resetSiteForm()
    await supervisor.fetchProgress()
  } catch (err) {
    siteFeedbackColor.value = 'danger'
    siteFeedback.value =
      err instanceof Error ? err.message : 'Unable to save company site.'
  } finally {
    savingSite.value = false
  }
}

async function confirmDeleteSite(site: CompanySite): Promise<void> {
  const alert = await alertController.create({
    header: `Delete ${site.name}?`,
    message:
      'Interns assigned to this site will be unassigned. Existing attendance records are preserved.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Delete site',
        role: 'destructive',
        handler: () => {
          void deleteSite(site)
        }
      }
    ]
  })

  await alert.present()
}

async function deleteSite(site: CompanySite): Promise<void> {
  try {
    await sitesStore.deleteSite(site.id)
    await supervisor.fetchProgress()
    if (editingSiteId.value === site.id) {
      resetSiteForm()
    }
    showToast('Company site deleted.', 'success')
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to delete company site.',
      'danger'
    )
  }
}

async function reviewLog(log: AttendanceLog, status: ReviewStatus): Promise<void> {
  reviewingLogId.value = log.id
  try {
    const result = await supervisor.reviewAttendance(
      log,
      status,
      logFeedback[log.id] ?? '',
      auth.displayName
    )
    delete logFeedback[log.id]
    selectedLogIds.value = selectedLogIds.value.filter((id) => id !== log.id)

    if (result.email.sent) {
      showToast(`Attendance ${status}. Intern notified by email.`, 'success')
    } else {
      showToast(
        `Attendance ${status}. Email was not sent: ${result.email.reason ?? 'unknown error'}.`,
        'warning'
      )
    }
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to review attendance log.',
      'danger'
    )
  } finally {
    reviewingLogId.value = ''
  }
}

async function reviewReport(
  report: AccomplishmentReport,
  status: ReviewStatus
): Promise<void> {
  reviewingReportId.value = report.id
  try {
    const result = await supervisor.reviewReport(
      report,
      status,
      reportFeedback[report.id] ?? '',
      auth.displayName
    )
    delete reportFeedback[report.id]
    selectedReportIds.value = selectedReportIds.value.filter(
      (id) => id !== report.id
    )

    if (result.email.sent) {
      showToast(`Report ${status}. Intern notified by email.`, 'success')
    } else {
      showToast(
        `Report ${status}. Email was not sent: ${result.email.reason ?? 'unknown error'}.`,
        'warning'
      )
    }
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to review accomplishment report.',
      'danger'
    )
  } finally {
    reviewingReportId.value = ''
  }
}

async function batchReviewReports(
  status: ReviewStatus
): Promise<void> {
  const items = filteredPendingReports.value.filter((report) =>
    selectedReportIds.value.includes(report.id)
  )
  if (!items.length) {
    return
  }

  reviewingBatch.value = true
  try {
    const result = await supervisor.reviewReportsBatch(
      items,
      status,
      batchFeedback.value,
      auth.displayName
    )
    batchFeedback.value = ''
    selectedReportIds.value = []
    const suffix = result.failures.length
      ? ` ${result.failures.length} failed: ${result.failures[0]}`
      : ''
    showToast(
      `${result.processed} report(s) ${status}; ${result.emailed} email(s) sent.${suffix}`,
      result.failures.length ? 'warning' : 'success'
    )
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to process report batch.',
      'danger'
    )
  } finally {
    reviewingBatch.value = false
  }
}

async function batchReviewLogs(status: ReviewStatus): Promise<void> {
  const items = filteredPendingLogs.value.filter((log) =>
    selectedLogIds.value.includes(log.id)
  )
  if (!items.length) {
    return
  }

  reviewingBatch.value = true
  try {
    const result = await supervisor.reviewLogsBatch(
      items,
      status,
      batchFeedback.value,
      auth.displayName
    )
    batchFeedback.value = ''
    selectedLogIds.value = []
    const suffix = result.failures.length
      ? ` ${result.failures.length} failed: ${result.failures[0]}`
      : ''
    showToast(
      `${result.processed} attendance log(s) ${status}; ${result.emailed} email(s) sent.${suffix}`,
      result.failures.length ? 'warning' : 'success'
    )
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to process attendance batch.',
      'danger'
    )
  } finally {
    reviewingBatch.value = false
  }
}

onMounted(async () => {
  try {
    await loadData()
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to load supervisor dashboard.',
      'danger'
    )
  }
})
</script>

<style scoped>
/* Typography Definition */
.font-aileron {
  font-family: 'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

.font-regular {
  font-family: 'Aileron', sans-serif !important;
  font-weight: 400 !important;
}

.font-bold {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 700 !important;
}

.font-heavy {
  font-family: 'Aileron Heavy', 'Aileron Black', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
}

/* Ionic Background Override */
ion-content.dashboard-content {
  --background: transparent !important;
}
ion-content.dashboard-content::part(background) {
  background: transparent !important;
}

/* Crisp & Transparent Glassmorphic Cards */
.trainext-glass-card {
  border-radius: 28px !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.06) 0%,
    rgba(4, 9, 22, 0.38) 40%,
    rgba(2, 6, 17, 0.50) 100%
  ) !important;
  backdrop-filter: blur(8px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(140%) !important;
  box-shadow: 
    0 16px 40px rgba(0, 0, 0, 0.75),
    inset 0 1px 1px rgba(255, 255, 255, 0.35) !important;
  padding: 24px !important;
  box-sizing: border-box !important;
}

/* Custom Navigation Segment Tabs */
.tab-nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 9999px;
  font-family: 'Aileron Bold', 'Aileron', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.25s ease;
}

.tab-nav-btn:hover {
  color: #ffffff;
}

.tab-nav-btn-active {
  background: rgba(0, 194, 255, 0.16) !important;
  color: #00C2FF !important;
  border: 1px solid rgba(0, 194, 255, 0.35) !important;
  box-shadow: 0 0 14px rgba(0, 194, 255, 0.25) !important;
}

.badge-counter {
  padding: 2px 7px;
  background: #ef4444;
  color: #ffffff;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 900;
}

/* Metric Stat Tiles */
.stat-tile {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 20px !important;
  padding: 14px 12px !important;
  text-align: center !important;
}

.stat-label {
  font-size: 9.5px !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
  color: #94a3b8 !important;
  margin: 0 !important;
}

.stat-value {
  font-size: 22px !important;
  font-family: 'Aileron Heavy', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  margin: 4px 0 0 0 !important;
}

/* Card Header Titles */
.card-title {
  font-family: 'Aileron Heavy', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 19px !important;
  font-weight: 900 !important;
  letter-spacing: -0.01em !important;
  margin: 0 !important;
}

.card-subtitle {
  font-family: 'Aileron Bold', 'Aileron', sans-serif !important;
  font-size: 12px !important;
  font-weight: 700 !important;
  letter-spacing: 0.01em !important;
  margin: 0 !important;
}

/* Form Input Lines */
.field-label {
  font-size: 10px !important;
  font-family: 'Aileron Heavy', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  letter-spacing: 0.15em !important;
  color: #cbd5e1 !important;
  text-transform: uppercase !important;
  display: block !important;
  margin-bottom: 6px !important;
}

.input-line-box {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  border-bottom: 1.25px solid rgba(255, 255, 255, 0.35) !important;
  padding-bottom: 6px !important;
  padding-top: 4px !important;
  transition: border-color 0.2s ease !important;
}

.input-line-box:focus-within {
  border-bottom-color: #00C2FF !important;
}

.field-input {
  width: 100% !important;
  background: transparent !important;
  color: #ffffff !important;
  font-size: 13.5px !important;
  outline: none !important;
  border: none !important;
}

.field-input::placeholder {
  color: rgba(148, 163, 184, 0.6) !important;
}

.textarea-box {
  border-bottom: 1.25px solid rgba(255, 255, 255, 0.35) !important;
  padding: 4px 0 !important;
  transition: border-color 0.2s ease !important;
}

.textarea-box:focus-within {
  border-bottom-color: #00C2FF !important;
}

.field-textarea {
  width: 100% !important;
  background: transparent !important;
  color: #ffffff !important;
  font-size: 13px !important;
  outline: none !important;
  border: none !important;
  resize: vertical !important;
}

.field-textarea::placeholder {
  color: rgba(148, 163, 184, 0.6) !important;
}

/* History Row */
.history-row {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.10) !important;
  border-radius: 20px !important;
  padding: 14px 16px !important;
  transition: all 0.2s ease !important;
}

.history-row:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(0, 194, 255, 0.3) !important;
}

/* Toggle Switch */
.toggle-switch {
  width: 44px;
  height: 24px;
  background: rgba(148, 163, 184, 0.3);
  border-radius: 9999px;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

.toggle-switch-thumb {
  width: 18px;
  height: 18px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.toggle-switch-active {
  background: #00C2FF !important;
  border-color: #00C2FF !important;
}

.toggle-switch-active .toggle-switch-thumb {
  transform: translateX(20px);
}

/* Cadence Filters */
.filter-pill {
  padding: 5px 12px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-pill-active {
  background: rgba(0, 194, 255, 0.2) !important;
  color: #00C2FF !important;
}

/* Custom Checkbox */
.custom-checkbox-container {
  display: inline-flex;
  align-items: center;
  position: relative;
  cursor: pointer;
}

.custom-checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.custom-checkbox-checkmark {
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.08);
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.custom-checkbox-container input:checked ~ .custom-checkbox-checkmark {
  background: #00C2FF;
  border-color: #00C2FF;
}

.custom-checkbox-container input:checked ~ .custom-checkbox-checkmark:after {
  content: '✓';
  color: #000000;
  font-weight: 900;
  font-size: 12px;
}

/* Badges / Chips */
.badge-pill {
  display: inline-flex !important;
  align-items: center !important;
  padding: 5px 12px !important;
  border-radius: 9999px !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  letter-spacing: 0.04em !important;
}

.badge-pill-success {
  background: rgba(16, 185, 129, 0.16) !important;
  color: #34d399 !important;
  border: 1px solid rgba(16, 185, 129, 0.35) !important;
}

.badge-pill-danger {
  background: rgba(239, 68, 68, 0.16) !important;
  color: #f87171 !important;
  border: 1px solid rgba(239, 68, 68, 0.35) !important;
}

.badge-pill-cyan {
  background: rgba(0, 194, 255, 0.16) !important;
  color: #00C2FF !important;
  border: 1px solid rgba(0, 194, 255, 0.35) !important;
}

.badge-pill-slate {
  background: rgba(148, 163, 184, 0.12) !important;
  color: #cbd5e1 !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
}

/* Action Buttons */
.pill-btn {
  border-radius: 9999px !important;
  padding: 12px 20px !important;
  font-family: 'Aileron Heavy', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  font-size: 13px !important;
  letter-spacing: 0.08em !important;
  cursor: pointer !important;
  border: none !important;
  transition: all 0.2s ease !important;
}

.pill-btn:disabled {
  opacity: 0.45 !important;
  cursor: not-allowed !important;
}

.btn-gradient-cyan {
  background: linear-gradient(135deg, #a5f3fc 0%, #67e8f9 45%, #38bdf8 100%) !important;
  color: #000000 !important;
  box-shadow: 0 0 20px rgba(0, 194, 255, 0.45) !important;
}

.btn-gradient-cyan:hover:not(:disabled) {
  filter: brightness(1.06) !important;
  box-shadow: 0 0 26px rgba(0, 194, 255, 0.65) !important;
}

.pill-btn-outline {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  color: #ffffff !important;
  border-radius: 9999px !important;
  padding: 6px 14px !important;
  font-size: 11.5px !important;
  font-weight: 800 !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}

.pill-btn-outline:hover {
  border-color: #00C2FF !important;
  color: #00C2FF !important;
}

.pill-btn-sm {
  background: rgba(0, 194, 255, 0.12) !important;
  border: 1px solid rgba(0, 194, 255, 0.3) !important;
  color: #00C2FF !important;
  border-radius: 9999px !important;
  padding: 5px 12px !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  cursor: pointer !important;
}

.pill-btn-danger-sm {
  background: rgba(239, 68, 68, 0.12) !important;
  border: 1px solid rgba(239, 68, 68, 0.3) !important;
  color: #f87171 !important;
  border-radius: 9999px !important;
  padding: 5px 12px !important;
  font-size: 11px !important;
  font-weight: 800 !important;
  cursor: pointer !important;
}
</style>