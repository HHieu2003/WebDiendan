
  // Tự động ẩn thông báo sau 3 giây
  setTimeout(() => {
    const successAlert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');

    if (successAlert) {
      const alert = new bootstrap.Alert(successAlert);
      alert.close();
    }

    if (errorAlert) {
      const alert = new bootstrap.Alert(errorAlert);
      alert.close();
    }
  }, 3000); // 3 giây
