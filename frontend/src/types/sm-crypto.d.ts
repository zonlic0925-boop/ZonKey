declare module 'sm-crypto' {
  interface Sm2KeyPair {
    privateKey: string;
    publicKey: string;
  }
  interface Sm4Settings {
    padding?: string;
    mode?: string;
    iv?: number[];
    output?: string;
  }
  const smCrypto: {
    sm2: {
      generateKeyPairHex: () => Sm2KeyPair;
      doEncrypt: (msg: string, publicKey: string, cipherMode?: number) => string;
      doDecrypt: (encryptData: string, privateKey: string, cipherMode?: number) => string;
    };
    sm3: (input: string) => string;
    sm4: {
      encrypt: (input: number[] | string, key: number[] | string, settings?: Sm4Settings) => number[] | string;
      decrypt: (input: number[] | string, key: number[] | string, settings?: Sm4Settings) => number[] | string;
    };
  };
  export default smCrypto;
}
