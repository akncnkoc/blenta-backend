"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmationEmailTr = exports.confirmationEmailEn = void 0;
const confirmationEmailEn = (email, passCode) => {
    return {
        from: '"Blenta" <info@blenta.app>',
        to: email,
        subject: "Your One Time Pass Code",
        text: `Your one-time passcode is: ${passCode}`,
        html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 2rem auto; padding: 1rem; border-radius: 0.5rem;">
        <h2>Welcome to Blenta!</h2>
        <p style="padding: 1rem 0; line-height: 2rem">
          Your one-time passcode is: <strong>${passCode}</strong>
        </p>
        <a href="https://blenta.app" style="color: black">Visit Blenta</a>
      </div>
    `.trim(),
    };
};
exports.confirmationEmailEn = confirmationEmailEn;
const confirmationEmailTr = (email, passCode) => {
    return {
        from: {
            name: "Blenta",
            address: "info@blenta.app",
        },
        to: {
            name: "User",
            address: email,
        },
        subject: `Tek Kullanımlık Şifreniz`,
        html: `
         <div
           style="
             font-family: sans-serif;
             max-width: 400px;
             margin: 2rem auto;
             padding: 1rem;
             border-radius: 0.5rem;
           "
         >
           <h2>Blentaya Hoş Geldiniz!</h2>
           <p style="padding: 1rem 0; line-height: 2rem">
             Tek Kullanımlık Şifreniz :  ${passCode}
           </p>
           <a href="#" target="_blank" style="color: black"> Blenta </a>
         </div>
       `.trim(),
    };
};
exports.confirmationEmailTr = confirmationEmailTr;
