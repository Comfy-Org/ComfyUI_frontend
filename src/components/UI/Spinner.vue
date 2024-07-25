<template>
  <span class="preloader">
    <div class="spinny">
      <div class="b1"></div>
      <div class="b2"></div>
      <div class="b3"></div>
    </div>
  </span>
</template>

<style type="text/css" scoped>
.preloader {
  display: block;
  width: 64px;
  height: 64px;
}

.spinny {
  margin: 2px auto 0;
  width: 64px;
  text-align: center;
}

.spinny > div {
  width: 13px;
  height: 13px;
  background-color: #fff;
  margin: 1px;
  border-radius: 100%;
  display: inline-block;
  animation: sk-bouncedelay 1.4s infinite ease-in-out both;
}

.spinny.dark > div {
  background-color: #000;
}

.spinny .b1 {
  animation-delay: -0.32s;
}

.spinny .b2 {
  animation-delay: -0.16s;
}

@keyframes sk-bouncedelay {
  0%,
  80%,
  100% {
    transform: scale(0.2);
    opacity: 0.3;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
