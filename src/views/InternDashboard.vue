<template>
  <ion-page>
    <AppHeader subtitle="Intern dashboard" />

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

      <!-- Main Responsive Grid / Container -->
      <div class="mx-auto max-w-4xl space-y-6 px-3.5 sm:px-6 py-6 font-aileron selection:bg-[#00C2FF] selection:text-black">
        
        <!-- Loading State -->
        <div v-if="!profile" class="trainext-glass-card text-center py-12">
          <ion-spinner name="crescent" class="text-[#00C2FF] mb-3 w-8 h-8 mx-auto" />
          <p class="text-sm font-semibold text-slate-300">Loading your intern profile…</p>
        </div>

        <template v-else>
          <!-- Verification Component -->
          <InternVerificationCard />

          <!-- Locked Features Notice -->
          <div v-if="!auth.isFullyVerified" class="trainext-glass-card border-rose-500/30">
            <div class="flex items-start gap-3.5">
              <div class="p-2.5 rounded-2xl bg-rose-500/10 text-rose-400 shrink-0">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 class="card-title text-white">OJT Features are Locked</h3>
                <p class="card-subtitle text-slate-400 mt-1">
                  Both your school coordinator and company supervisor must approve your placement.
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-2.5 mt-4">
              <div class="badge-pill" :class="statusBadgeClass(profile.enrollment_status)">
                School Enrollment: {{ profile.enrollment_status }}
              </div>
              <div class="badge-pill" :class="statusBadgeClass(profile.deployment_status)">
                Company Deployment: {{ profile.deployment_status }}
              </div>
            </div>

            <p class="mt-4 text-xs font-regular text-slate-400/80 leading-relaxed">
              Geofenced attendance, accomplishment proofs, and safe-at-base confirmation become available once both verifications are approved.
            </p>
          </div>

          <!-- Verified Section -->
          <template v-if="auth.isFullyVerified">
            <!-- Awaiting Site Card -->
            <div v-if="!site" class="trainext-glass-card border-amber-500/30">
              <div class="flex items-center gap-3">
                <div class="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 class="card-title text-white">Awaiting Site Assignment</h3>
                  <p class="card-subtitle text-slate-400 mt-0.5">Supervisor review pending</p>
                </div>
              </div>
              <p class="mt-4 text-xs text-slate-300 leading-relaxed font-regular">
                Your supervisor has verified your deployment but has not assigned you to a company site yet. Once assigned, the live geofence map and attendance controls will appear here.
              </p>
            </div>

            <!-- Active Geofence & Map View -->
            <template v-else>
              <div class="trainext-glass-card">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div class="flex items-center gap-3">
                    <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="card-title text-white">{{ site.name }}</h3>
                      <p class="card-subtitle text-[#00C2FF]">
                        {{ site.address || 'Company site' }} · {{ site.radius_meters.toFixed(1) }}m radius
                      </p>
                    </div>
                  </div>
                  <div class="badge-pill" :class="site.is_active ? 'badge-pill-success' : 'badge-pill-danger'">
                    {{ site.is_active ? 'Active Site' : 'Inactive Site' }}
                  </div>
                </div>

                <div class="rounded-2xl overflow-hidden border border-white/20 shadow-inner">
                  <GeofenceMap :site="site" height="340px" />
                </div>

                <p v-if="!site.is_active" class="mt-3 text-xs text-rose-400 font-semibold">
                  This site is currently inactive. Clock-in is disabled until your supervisor re-enables it.
                </p>
              </div>

              <!-- Live Attendance & Punch Clock Card -->
              <div class="trainext-glass-card">
                <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div class="flex items-center gap-3">
                    <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="card-title text-white">Attendance Radar</h3>
                      <p class="card-subtitle text-slate-400">Clock in and out from inside the site geofence</p>
                    </div>
                  </div>

                  <!-- Geofence & GPS Status Pills -->
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="badge-pill" :class="inside ? 'badge-pill-success' : 'badge-pill-danger'">
                      <span class="w-2 h-2 rounded-full mr-1.5" :class="inside ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
                      {{ inside ? 'Inside Geofence' : 'Outside Geofence' }}
                    </div>
                    <div class="badge-pill badge-pill-slate">
                      {{ distanceLabel }}
                    </div>
                    <div v-if="position?.accuracy" class="badge-pill badge-pill-cyan">
                      GPS ±{{ position.accuracy.toFixed(1) }}m
                    </div>
                    <div v-if="!position" class="badge-pill badge-pill-amber">
                      Locating GPS…
                    </div>
                  </div>
                </div>

                <p v-if="geoError" class="mt-2 text-xs text-rose-400 font-semibold">{{ geoError }}</p>

                <!-- Ongoing Active Shift -->
                <div v-if="attendance.openLog" class="mt-5 rounded-2xl bg-[#061024]/70 border border-[#00C2FF]/30 p-5 backdrop-blur-md">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-[10px] font-heavy uppercase tracking-widest text-slate-400">Shift Started</p>
                      <p class="text-sm font-semibold text-white mt-0.5">
                        {{ formatDateTime(attendance.openLog.clock_in_at) }}
                      </p>
                    </div>
                    <span class="badge-pill badge-pill-cyan uppercase text-[10px]">On-Duty</span>
                  </div>

                  <!-- Digital Timer Display -->
                  <div class="my-5 text-center">
                    <p class="text-4xl md:text-5xl font-heavy tracking-wider text-[#00C2FF] drop-shadow-[0_0_15px_rgba(0,194,255,0.4)]">
                      {{ elapsedLabel }}
                    </p>
                    <p class="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Elapsed Time Rendered</p>
                  </div>

                  <button
                    type="button"
                    class="pill-btn btn-danger-gradient w-full flex items-center justify-center gap-2"
                    :disabled="attendance.loading || !position"
                    @click="confirmClockOut"
                  >
                    <ion-spinner v-if="attendance.loading" name="crescent" class="w-4 h-4 text-white" />
                    CLOCK OUT NOW
                  </button>
                </div>

                <!-- Ready to Clock In -->
                <div v-else class="mt-5">
                  <button
                    type="button"
                    class="pill-btn btn-gradient-cyan w-full flex items-center justify-center gap-2"
                    :disabled="!canClockIn || attendance.loading"
                    @click="clockIn"
                  >
                    <ion-spinner v-if="attendance.loading" name="crescent" class="w-4 h-4 text-black" />
                    CLOCK IN
                  </button>
                  <p class="mt-3 text-center text-[11px] text-slate-400 font-regular">
                    Clock-in is accepted only while your live position is strictly inside the {{ site.radius_meters.toFixed(1) }}m site radius.
                  </p>
                </div>
              </div>
            </template>

            <!-- Safety Component -->
            <SafeAtBaseCard :open-log="Boolean(attendance.openLog)" />
          </template>

          <!-- OJT Hours Progress Card -->
          <div class="trainext-glass-card">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div class="flex items-center gap-3">
                <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 class="card-title text-white">OJT Hours Progress</h3>
                  <p class="card-subtitle text-slate-400">Approved attendance counts toward required hours</p>
                </div>
              </div>
              <div class="text-right">
                <span class="text-2xl font-heavy text-white">{{ approvedHoursLabel }}</span>
                <span class="text-xs text-slate-400 font-bold"> / {{ requiredHoursLabel }} hrs</span>
              </div>
            </div>

            <!-- Glowing Cyan Progress Bar -->
            <div class="w-full h-3 rounded-full bg-slate-800/80 overflow-hidden border border-white/10 p-0.5 my-3">
              <div
                class="h-full rounded-full bg-gradient-to-r from-[#A5F3FC] via-[#00C2FF] to-[#38BDF8] shadow-[0_0_12px_#00C2FF] transition-all duration-500"
                :style="{ width: `${Math.min(progressRatio * 100, 100)}%` }"
              ></div>
            </div>

            <!-- Responsive Stat Counters -->
            <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div class="stat-tile">
                <p class="stat-label">Approved</p>
                <p class="stat-value text-emerald-400">{{ approvedHoursLabel }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Pending</p>
                <p class="stat-value text-amber-400">{{ pendingHoursLabel }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Remaining</p>
                <p class="stat-value text-slate-200">{{ remainingHoursLabel }}</p>
              </div>
              <div class="stat-tile">
                <p class="stat-label">Progress</p>
                <p class="stat-value text-[#00C2FF]">{{ progressPercentLabel }}</p>
              </div>
            </div>
          </div>

          <!-- Attendance History Card -->
          <div class="trainext-glass-card">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 class="card-title text-white">Attendance History</h3>
                <p class="card-subtitle text-slate-400">Supervisor approvals and verification logs</p>
              </div>
            </div>

            <p v-if="!attendance.logs.length" class="text-center py-6 text-xs text-slate-400 font-regular">
              No attendance logs recorded yet.
            </p>

            <div v-else class="space-y-3">
              <div
                v-for="log in attendance.logs"
                :key="log.id"
                class="history-row"
              >
                <div class="flex-1">
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-heavy text-white">{{ formatDate(log.clock_in_at) }}</h4>
                    <span class="badge-pill text-[10px]" :class="statusBadgeClass(log.status)">
                      {{ log.status }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-300 mt-1 font-regular">
                    In: <strong class="text-white">{{ formatTime(log.clock_in_at) }}</strong> · Out: 
                    <strong class="text-white">{{ log.clock_out_at ? formatTime(log.clock_out_at) : 'In Progress' }}</strong>
                  </p>
                  <p class="text-[11px] text-slate-400 mt-0.5">
                    Hours: <span class="text-[#00C2FF] font-bold">{{ Number(log.hours_rendered).toFixed(2) }}</span> · 
                    Coords: {{ log.clock_in_latitude.toFixed(4) }}, {{ log.clock_in_longitude.toFixed(4) }}
                  </p>
                  <p v-if="log.feedback" class="text-xs text-cyan-200 mt-1.5 p-2 rounded-lg bg-cyan-950/30 border border-cyan-800/40">
                    Feedback: {{ log.feedback }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Submit Daily Accomplishment Card -->
          <div class="trainext-glass-card">
            <div class="flex items-center gap-3 mb-5">
              <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h3 class="card-title text-white">Daily Accomplishment Report</h3>
                <p class="card-subtitle text-slate-400">Attach proof files, accomplishments, and activity summaries</p>
              </div>
            </div>

            <template v-if="auth.isFullyVerified">
              <form @submit.prevent="submitReport" class="space-y-4">
                <div>
                  <label class="field-label">TASK TITLE</label>
                  <div class="input-line-box">
                    <svg class="text-[#00C2FF] w-4 h-4 mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <input
                      v-model="reportTitle"
                      type="text"
                      placeholder="e.g., Implemented geofence verification algorithm"
                      class="field-input"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="field-label">REPORT DATE</label>
                    <div class="input-line-box">
                      <svg class="text-[#00C2FF] w-4 h-4 mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <input
                        v-model="reportDate"
                        type="date"
                        class="field-input text-slate-200"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="field-label">HOURS SPENT</label>
                    <div class="input-line-box">
                      <svg class="text-[#00C2FF] w-4 h-4 mr-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <input
                        v-model="reportHours"
                        type="number"
                        min="0"
                        max="24"
                        step="0.25"
                        placeholder="8"
                        class="field-input"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label class="field-label">ACCOMPLISHED TASKS & LEARNINGS</label>
                  <div class="textarea-box">
                    <textarea
                      v-model="reportTasks"
                      rows="4"
                      placeholder="Describe the tasks completed, technical obstacles solved, and key outputs..."
                      class="field-textarea"
                    ></textarea>
                  </div>
                </div>

                <!-- Proof Attachments Box -->
                <div class="rounded-2xl border border-dashed border-white/20 p-4 bg-white/[0.02]">
                  <p class="text-xs font-heavy tracking-wider uppercase text-slate-300">Proof Attachments</p>
                  <input
                    ref="fileInput"
                    type="file"
                    multiple
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/*"
                    class="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-heavy file:bg-cyan-950 file:text-[#00C2FF] file:cursor-pointer hover:file:bg-cyan-900"
                    @change="handleFiles"
                  />
                  <p class="mt-1.5 text-[11px] text-slate-400">
                    Images, PDFs, Docs, or Videos. Up to 5 files, 50MB each.
                  </p>

                  <div v-if="reportFiles.length" class="mt-3 flex flex-wrap gap-2">
                    <div
                      v-for="(file, index) in reportFiles"
                      :key="`${file.name}-${index}`"
                      class="badge-pill badge-pill-cyan flex items-center gap-1 cursor-pointer"
                      @click="removeFile(index)"
                    >
                      <span>{{ file.name }}</span>
                      <span class="text-rose-400 font-bold ml-1">×</span>
                    </div>
                  </div>

                  <div class="mt-4">
                    <label class="field-label">EXTERNAL PROOF LINKS (ONE PER LINE)</label>
                    <div class="textarea-box mt-1">
                      <textarea
                        v-model="reportLinks"
                        rows="2"
                        placeholder="https://github.com/... or Google Drive link"
                        class="field-textarea"
                      ></textarea>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  class="pill-btn btn-gradient-cyan w-full flex items-center justify-center gap-2 mt-4"
                  :disabled="accomplishments.loading"
                >
                  <ion-spinner v-if="accomplishments.loading" name="crescent" class="w-4 h-4 text-black" />
                  SUBMIT ACCOMPLISHMENT
                </button>
              </form>
            </template>
            <p v-else class="text-xs text-slate-400 font-regular">
              Accomplishment submission unlocks after both verification approvals.
            </p>
          </div>

          <!-- Accomplishment Reports List Card -->
          <div class="trainext-glass-card">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div class="flex items-center gap-3">
                <div class="p-2.5 rounded-2xl bg-[#00C2FF]/10 text-[#00C2FF] border border-[#00C2FF]/20">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 class="card-title text-white">Submitted Reports</h3>
                  <p class="card-subtitle text-slate-400">
                    {{ accomplishments.approvedCount }} approved · {{ accomplishments.pendingCount }} pending · {{ accomplishments.proofCount }} file(s)
                  </p>
                </div>
              </div>

              <button
                v-if="accomplishments.reports.length"
                type="button"
                class="pill-btn-outline"
                @click="exportReports"
              >
                Export CSV
              </button>
            </div>

            <p v-if="!accomplishments.reports.length" class="text-center py-6 text-xs text-slate-400 font-regular">
              No accomplishment reports submitted yet.
            </p>

            <div v-else class="space-y-3">
              <div
                v-for="report in accomplishments.reports"
                :key="report.id"
                class="history-row flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-heavy text-white">{{ report.title }}</h4>
                    <span class="badge-pill text-[10px]" :class="statusBadgeClass(report.status)">
                      {{ report.status }}
                    </span>
                  </div>
                  <p class="text-xs text-[#00C2FF] font-semibold mt-0.5">
                    {{ formatDate(report.report_date) }} · {{ Number(report.hours_spent).toFixed(2) }} hr(s)
                  </p>
                  <p class="text-xs text-slate-300 mt-1 whitespace-pre-line font-regular">
                    {{ report.tasks }}
                  </p>
                  <p v-if="report.feedback" class="text-xs text-cyan-200 mt-1 p-2 rounded-lg bg-cyan-950/30 border border-cyan-800/40">
                    Feedback: {{ report.feedback }}
                  </p>

                  <div v-if="report.proofs?.length" class="mt-2 flex flex-wrap gap-2">
                    <span
                      v-for="proof in report.proofs"
                      :key="proof.id"
                      class="badge-pill badge-pill-cyan text-[10px] cursor-pointer"
                      @click="openProofs(report)"
                    >
                      📎 {{ proof.kind }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button
                    v-if="report.proofs?.length"
                    type="button"
                    class="pill-btn-sm"
                    @click="openProofs(report)"
                  >
                    View proofs
                  </button>
                  <button
                    v-if="report.status === 'pending'"
                    type="button"
                    class="pill-btn-danger-sm"
                    @click="removeReport(report.id)"
                  >
                    Delete
                  </button>
                </div>
              </div>
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
        :duration="3500"
        @ionDidDismiss="toast.open = false"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
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
import GeofenceMap from '@/components/GeofenceMap.vue'
import InternVerificationCard from '@/components/InternVerificationCard.vue'
import SafeAtBaseCard from '@/components/SafeAtBaseCard.vue'
import ProofViewerModal from '@/components/ProofViewerModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useSitesStore } from '@/stores/sites'
import { useAttendanceStore } from '@/stores/attendance'
import { useAccomplishmentsStore } from '@/stores/accomplishments'
import { useGeolocation } from '@/composables/useGeolocation'
import {
  formatDistanceMeters,
  haversineDistanceMeters,
  isStrictlyWithinGeofence
} from '@/lib/geofence'
import { supabase } from '@/lib/supabase'
import { csvFilename, downloadCsv } from '@/lib/csv'
import type {
  AccomplishmentReport,
  ApprovalStatus
} from '@/types'

const auth = useAuthStore()
const sitesStore = useSitesStore()
const attendance = useAttendanceStore()
const accomplishments = useAccomplishmentsStore()
const { position, error: geoError, start: startGeolocation, stop: stopGeolocation } =
  useGeolocation()

const now = ref(Date.now())
const reportTitle = ref('')
const reportDate = ref(todayLocal())
const reportHours = ref('0')
const reportTasks = ref('')
const reportLinks = ref('')
const reportFiles = ref<File[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const viewerOpen = ref(false)
const viewerReport = ref<AccomplishmentReport | null>(null)
const toast = reactive({
  open: false,
  message: '',
  color: 'success'
})

let clockTimer: number | null = null
let profileChannel: RealtimeChannel | null = null

const profile = computed(() => auth.profile)
const site = computed(() => {
  if (!profile.value?.company_site_id) {
    return null
  }
  return (
    sitesStore.sites.find((item) => item.id === profile.value?.company_site_id) ?? null
  )
})

const distanceMeters = computed<number | null>(() => {
  if (!position.value || !site.value) {
    return null
  }
  return haversineDistanceMeters(
    {
      latitude: position.value.latitude,
      longitude: position.value.longitude
    },
    {
      latitude: site.value.latitude,
      longitude: site.value.longitude
    }
  )
})

const inside = computed(() => {
  if (!site.value || !position.value) {
    return false
  }
  return isStrictlyWithinGeofence(
    {
      latitude: position.value.latitude,
      longitude: position.value.longitude
    },
    site.value
  )
})

const distanceLabel = computed(() => {
  if (distanceMeters.value === null) {
    return 'Distance unavailable'
  }
  return `${formatDistanceMeters(distanceMeters.value)} from center`
})

const canClockIn = computed(
  () =>
    Boolean(
      auth.isFullyVerified &&
        site.value &&
        site.value.is_active &&
        position.value &&
        inside.value &&
        !attendance.openLog
    )
)

const elapsedLabel = computed(() => {
  if (!attendance.openLog) {
    return '00:00:00'
  }
  const elapsedMs = Math.max(
    now.value - new Date(attendance.openLog.clock_in_at).getTime(),
    0
  )
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
})

const requiredHours = computed(() => Number(profile.value?.required_hours ?? 0))
const requiredHoursLabel = computed(() => requiredHours.value.toFixed(2))
const approvedHoursLabel = computed(() => attendance.approvedHours.toFixed(2))
const pendingHoursLabel = computed(() => attendance.pendingHours.toFixed(2))
const remainingHoursLabel = computed(() =>
  Math.max(requiredHours.value - attendance.approvedHours, 0).toFixed(2)
)
const progressRatio = computed(() => {
  if (requiredHours.value <= 0) {
    return 0
  }
  return Math.min(attendance.approvedHours / requiredHours.value, 1)
})
const progressPercentLabel = computed(
  () => `${(progressRatio.value * 100).toFixed(1)}%`
)

function todayLocal(): string {
  const current = new Date()
  const offset = current.getTimezoneOffset() * 60000
  return new Date(current.getTime() - offset).toISOString().slice(0, 10)
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

function statusBadgeClass(status: ApprovalStatus | string): string {
  if (status === 'approved') return 'badge-pill-success'
  if (status === 'rejected') return 'badge-pill-danger'
  return 'badge-pill-amber'
}

function showToast(message: string, color = 'success'): void {
  toast.message = message
  toast.color = color
  toast.open = true
}

function openProofs(report: AccomplishmentReport): void {
  viewerReport.value = report
  viewerOpen.value = true
}

function handleFiles(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (files.length > 5) {
    showToast('Attach at most 5 proof files per report.', 'danger')
    input.value = ''
    return
  }
  const tooLarge = files.find((file) => file.size > 50 * 1024 * 1024)
  if (tooLarge) {
    showToast(`${tooLarge.name} exceeds the 50 MB limit.`, 'danger')
    input.value = ''
    return
  }
  reportFiles.value = files
}

function removeFile(index: number): void {
  reportFiles.value = reportFiles.value.filter((_, position) => position !== index)
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function exportReports(): void {
  downloadCsv(
    csvFilename('trainext-accomplishments'),
    accomplishments.reports,
    [
      { label: 'Report date', value: (row) => row.report_date },
      { label: 'Title', value: (row) => row.title },
      { label: 'Tasks', value: (row) => row.tasks },
      { label: 'Hours spent', value: (row) => Number(row.hours_spent).toFixed(2) },
      { label: 'Status', value: (row) => row.status },
      { label: 'Feedback', value: (row) => row.feedback ?? '' },
      { label: 'Proof count', value: (row) => row.proofs?.length ?? 0 }
    ]
  )
}

function subscribeProfile(internId: string): void {
  if (profileChannel) {
    void supabase.removeChannel(profileChannel)
  }
  profileChannel = supabase
    .channel(`profile-${internId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${internId}`
      },
      () => {
        void auth.fetchProfile()
      }
    )
    .subscribe()
}

async function loadData(): Promise<void> {
  await auth.fetchProfile()

  if (!profile.value) {
    return
  }

  await Promise.all([
    auth.fetchMentors(),
    sitesStore.fetchSites(),
    attendance.fetchLogs(profile.value.id),
    accomplishments.fetchReports(profile.value.id)
  ])

  attendance.subscribe(profile.value.id)
  accomplishments.subscribe(profile.value.id)
  subscribeProfile(profile.value.id)
}

async function handleRefresh(event: CustomEvent): Promise<void> {
  try {
    await loadData()
  } finally {
    (event.target as HTMLIonRefresherElement).complete()
  }
}

async function clockIn(): Promise<void> {
  if (!profile.value || !site.value || !position.value) {
    showToast('A GPS position and assigned site are required.', 'danger')
    return
  }

  if (!auth.isFullyVerified) {
    showToast('Both enrollment and deployment must be verified.', 'danger')
    return
  }

  const within = isStrictlyWithinGeofence(
    {
      latitude: position.value.latitude,
      longitude: position.value.longitude
    },
    site.value
  )

  if (!within) {
    showToast(
      `Clock-in blocked. You are ${formatDistanceMeters(
        haversineDistanceMeters(
          {
            latitude: position.value.latitude,
            longitude: position.value.longitude
          },
          {
            latitude: site.value.latitude,
            longitude: site.value.longitude
          }
        )
      )} from the site center; the radius is ${site.value.radius_meters.toFixed(1)} m.`,
      'danger'
    )
    return
  }

  try {
    await attendance.clockIn(site.value.id, position.value)
    showToast('Clocked in successfully.', 'success')
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Clock-in failed.',
      'danger'
    )
  }
}

async function confirmClockOut(): Promise<void> {
  const alert = await alertController.create({
    header: 'Clock out now?',
    message: 'Your rendered hours will be computed and sent to your supervisor.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      {
        text: 'Clock out',
        role: 'confirm',
        handler: () => {
          void clockOut()
        }
      }
    ]
  })

  await alert.present()
}

async function clockOut(): Promise<void> {
  if (!position.value) {
    showToast('A GPS position is required to clock out.', 'danger')
    return
  }

  try {
    const log = await attendance.clockOut(position.value)
    showToast(
      `Clocked out. ${Number(log.hours_rendered).toFixed(2)} hour(s) rendered.`,
      'success'
    )
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Clock-out failed.',
      'danger'
    )
  }
}

async function submitReport(): Promise<void> {
  if (!profile.value) {
    return
  }

  if (!auth.isFullyVerified) {
    showToast('Both verification approvals are required before submitting.', 'danger')
    return
  }

  const title = reportTitle.value.trim()
  const tasks = reportTasks.value.trim()
  const hours = Number(reportHours.value)
  const links = reportLinks.value
    .split('\n')
    .map((link) => link.trim())
    .filter(Boolean)

  if (!title || !tasks) {
    showToast('Task title and accomplishment details are required.', 'danger')
    return
  }

  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    showToast('Hours must be between 0 and 24.', 'danger')
    return
  }

  if (links.length > 5) {
    showToast('Add at most 5 external proof links.', 'danger')
    return
  }

  const todayLog =
    attendance.logs.find(
      (log) =>
        log.clock_out_at !== null &&
        log.clock_in_at.slice(0, 10) === reportDate.value
    ) ?? null

  try {
    await accomplishments.submitReport(profile.value.id, {
      report_date: reportDate.value,
      title,
      tasks,
      hours_spent: hours,
      attendance_log_id: todayLog?.id ?? null,
      files: reportFiles.value,
      links
    })
    reportTitle.value = ''
    reportTasks.value = ''
    reportHours.value = '0'
    reportLinks.value = ''
    reportFiles.value = []
    if (fileInput.value) {
      fileInput.value.value = ''
    }
    showToast('Accomplishment report submitted for review.', 'success')
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to submit report.',
      'danger'
    )
  }
}

async function removeReport(id: string): Promise<void> {
  try {
    await accomplishments.deleteReport(id)
    showToast('Pending report deleted.', 'success')
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to delete report.',
      'danger'
    )
  }
}

onMounted(async () => {
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)

  await startGeolocation().catch(() => undefined)

  try {
    await loadData()
  } catch (err) {
    showToast(
      err instanceof Error ? err.message : 'Unable to load intern dashboard.',
      'danger'
    )
  }
})

onBeforeUnmount(() => {
  if (clockTimer !== null) {
    window.clearInterval(clockTimer)
    clockTimer = null
  }
  attendance.unsubscribe()
  accomplishments.unsubscribe()
  if (profileChannel) {
    void supabase.removeChannel(profileChannel)
    profileChannel = null
  }
  stopGeolocation()
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

.font-semibold {
  font-family: 'Aileron SemiBold', 'Aileron', sans-serif !important;
  font-weight: 600 !important;
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

/* Metric Stat Tiles */
.stat-tile {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 18px !important;
  padding: 14px 12px !important;
  text-align: center !important;
}

.stat-label {
  font-size: 10px !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
  color: #94a3b8 !important;
  margin: 0 !important;
}

.stat-value {
  font-size: 20px !important;
  font-family: 'Aileron Heavy', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  margin: 4px 0 0 0 !important;
}

/* History Row */
.history-row {
  background: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.10) !important;
  border-radius: 18px !important;
  padding: 14px 16px !important;
  transition: all 0.2s ease !important;
}

.history-row:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(0, 194, 255, 0.3) !important;
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

.badge-pill-amber {
  background: rgba(245, 158, 11, 0.16) !important;
  color: #fbbf24 !important;
  border: 1px solid rgba(245, 158, 11, 0.35) !important;
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

/* Pill Buttons */
.pill-btn {
  border-radius: 9999px !important;
  padding: 13.5px 22px !important;
  font-family: 'Aileron Heavy', 'Aileron Bold', 'Aileron', sans-serif !important;
  font-weight: 900 !important;
  font-size: 13.5px !important;
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

.btn-danger-gradient {
  background: linear-gradient(135deg, #f87171 0%, #ef4444 50%, #dc2626 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.45) !important;
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