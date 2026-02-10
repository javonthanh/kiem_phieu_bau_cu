const AppIcon = ({ size = 20 }: { size?: number }) => {
  return (
    <img 
      src="/assets/icon.png" 
    //   alt="App Icon"
      style={{ width: size, height: size }} // Dùng style để đảm bảo đúng kích thước pixel
      className="object-contain"
    />
  );
};

export default AppIcon;