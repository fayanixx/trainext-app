<template>
  <ion-app>
    <CyberToast />
    <router-view />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp } from '@ionic/vue';
import CyberToast from '@/components/CyberToast.vue';
</script>