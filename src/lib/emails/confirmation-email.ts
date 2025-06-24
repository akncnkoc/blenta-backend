export const confirmationEmailEn = (email: string, passCode: string) => {
  return {
    from: {
      name: "Blenta",
      address: "info@blenta.com",
    },
    to: {
      name: "User",
      address: email,
    },
    subject: `Your One Time Pass Code`,
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
           <h2>Welcome to Blenta!</h2>
           <p style="padding: 1rem 0; line-height: 2rem">
             Your one time passcode is ${passCode}
           </p>
           <a href="#" target="_blank" style="color: black"> Blenta </a>
         </div>
       `.trim(),
  };
};

export const confirmationEmailTr = (email: string, passCode: string) => {
  return {
    from: {
      name: "Blenta",
      address: "info@blenta.com",
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
