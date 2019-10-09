//imports
const _ = require('lodash');
const fs = require('fs');
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const PNF = require('google-libphonenumber').PhoneNumberFormat;
const data = fs.readFileSync('./input.csv', 'utf8')

/*Define o regex que será usado para parsear o arquivo. Foi usado regex ao inves de simplismente um .split(',') pois
não queremos que as virgulas entre aspas contem como delimitadores */
const regex = /,(?=(?:[^\"]*\"[^\"]*\")*(?![^\"]*\"))/g

//Array que será usado para armazenar os objetos
let arrayobj = []

//Função que usa Regex para determinar se um email é valido (não tem caracteres extras ou informações a mais, etc)
function checkEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

//Divide o input por linhas, criando um array onde cada elemento é uma linha
let lines = data.split("\n");

//Pega a primeira linha do input que será nosso header
header = lines[0].split(regex);


/* 
 * Dentro do For temos a logica principal de parseamento;
 * Basicamente usamos a função da biblioteca lodash .zip para associar as informações de cada linha do input com o header,
 * para dessa forma sabermos qual informação se trata de um telefone, um email da mãe, etc;
 * Criamos então um modelo (variavel obj) de como queremos que nosso objeto seja, então analisamos as informações da linha, adicionamos ao objeto,
 * sempre se atentando para casos de bordas, adicionamos o obj recem criado ao nosso array "arrayObj"
 */
for (let j = 1; j < lines.length; j++) {
    //Criamos um array 2D, onde cada elemento é um par [header, informação], por exemplo zipado = [[fullname, Pedro Pupo Alves], [eid, 0001], ...]
    let zipado = _.zip(header, lines[j].split(regex))
    //modelo do json
    let obj = {fullname: "", eid: "", classes: [], addresses: [], invisible: false, see_all: false} 
    //for para analisar as informações da linha em relação ao header
    for (let i = 0; i < zipado.length; i++) {
        //caso o nome no header seja uma key do objeto podemos associar diretamente no objeto essa key com o valor em "zipado" 
        if(_.has(obj, zipado[i][0])){
            obj[zipado[i][0]] = zipado[i][1]
        }
        //Caso contrario, devemos determinar se o par que estamos analisando se refere a classes ou adresses
        //Com base no enunciado e exemplo dado tomei a liberdade de assumir que quando a informação se refere a salas de aula, a key "class" é usada no header do csv
        //sendo assim usamos regex para fazer a busca por "class" (case insensitive) no header do par 
        else if(zipado[i][0].search(/class/i) != -1){ 
            //Como podemos ter mais de uma sala por campo de input, parseamos o input em relação a '/' e ',' (que foram os limitadores usados no exemplo)
            zipado[i][1] = zipado[i][1].replace("/", ",")
            zipado[i][1] = zipado[i][1].toString().split(',')
            //Para cada uma das classes adicionamos a classe ao vetor "classes" no objeto
            zipado[i][1].forEach(element => {
                element = element.replace('"', '')
                element =  element.trim()
                if(element != ""){
                    obj["classes"].push(element)
                }
            });      
        }
        //caso não fosse uma sala, o par que estamos analisando se refere a um address
        //divimos essa etapa em 2 partes uma para telefones, outra para email
        else{
            //caso encontremos a palavra "phone" no elemento do header, sabemos que se trata de um telefone
            if(zipado[i][0].search(/phone/i) != -1){
                //antes de tudo verificamos se realmente existe um telefone no campo ou se o campo não esta vazio  
                if(zipado[i][1] != undefined && zipado[i][1] != 0){
                    //Como podemos ter mais de um telefone por campo de input, parseamos o input em relação a '/' e ',' (que foram os limitadores usados no exemplo)
                    zipado[i][1] = zipado[i][1].replace("/", ",")              
                    zipado[i][1] = zipado[i][1].toString().split(',') 
                    //Analisamos agora cada um dos telefones
                    zipado[i][1].forEach(telefone => {
                        /*
                         *Um caso de borda que inclui, foi o caso de um telefone repetido ser cadastrado, por exemplo a mae o filho terem o mesmo numero
                         *apesar desse caso não ocorrer no exemplo para telefones, ele ocorre para emails, sendo assim julguei valido fazer a verificação
                         *para telefones tambem. No caso onde o telefone ja foi cadastrado, incluimos as tags associadas a esse telefone com as associadas
                         *ao telefone que foi cadastrado anteriormente
                         */
                        let telefoneJaCadastrado = false  //variavel de controle
                        //procuramos por cada endereço ja adicionado no objeto que estamos criando e vemos se o telefone é o mesmo
                        obj["addresses"].forEach(endereco => {
                            if(endereco.address == telefone){
                                //caso o telefone seja o mesmo, parseamos as tags e adicionamos
                                zipado[i][0] = zipado[i][0].replace(" ", ",")
                                zipado[i][0] = zipado[i][0].toString().split(",")
                                zipado[i][0].forEach(element => {
                                    element = element.replace('"', '')
                                    element =  element.trim()
                                    //adicionamos cada tag parseada se ela não for vazia, igual a "phone", ou ja estiver nas tags do endereço que vamos adicionar
                                    if(element != "phone" && element != "" && endereco["tags"].indexOf(element) == -1){
                                        endereco["tags"].push(element)        
                                    }
                                });
                                telefoneJaCadastrado = true //atualizamos a varivel de controle
                            }
                        });
                        //caso o telefone não tenha sido cadastrado ainda, verificamos se o telefona é valido, parseamos e adicionamos as tags, e enviamos o "address" pro vetor "addresses" de obj
                        if(! telefoneJaCadastrado){
                            //a função parseAndKeepRawInput da biblioteca google-libphonenumber apresenta erro quando temos uma letra no input,
                            //sendo assim, primeiro verificamos se nosso possivel telefone nao contem letras
                            if (! telefone.match(/[a-z]/i)){
                                const numero = phoneUtil.parseAndKeepRawInput(telefone, 'BR')
                                if(phoneUtil.isValidNumber(numero)){
                                    //caso seja um numero valido, criamos um novo object "address"
                                    let address = {}
                                    address["type"] = "phone"
                                    address["tags"] = []  
                                    //parseamos as tags do header                                                                      
                                    zipado[i][0] = zipado[i][0].replace(" ", ",")                                            
                                    zipado[i][0] = zipado[i][0].toString().split(",")                                        
                                    zipado[i][0].forEach(element => {
                                        //para cada tag, se for uma tag valida a adicionamos a address["tags"]
                                        element = element.replace('"', '')
                                        element =  element.trim()
                                        if(element != "phone" && element != ""){                                            
                                            address["tags"].push(element)        
                                        }
                                    });
                                    //replace para tirar o '+' do numero e ficar igual ao output exemplo
                                    address["address"] = (phoneUtil.format(numero, PNF.E164)).replace("+", "")   
                                    //adicionamos o novo endereço criado a lista de "addresses" de "obj"          
                                    obj["addresses"].push(address)
                                }
                            }
                        }
                    });
                }
            }
            /*
             *por ultimo verificamos o caso onde estamos analisando um email
             *o processo de parseamento e verificação é bem similar ao aplicado para os telefones
             */
            else if(zipado[i][0].search(/email/i) != -1){  
                //verificamos se o campo nao esta vazio 
                if(zipado[i][1] != undefined){
                    //parseamos para o caso de termos mais de um email por input
                    zipado[i][1] = zipado[i][1].replace("/", ",")
                    zipado[i][1] = zipado[i][1].toString().split(',')
                    //analisamos cada um dos emails parsaeados
                    zipado[i][1].forEach(email => {
                        let emailJaCadastrado = false //variavel de controle
                        // mesma logica aplicada para verificar se o telefone ja tinha sido utilizado, agora para email
                        obj["addresses"].forEach(endereco => {
                            if(endereco.address == email){
                                zipado[i][0] = zipado[i][0].toString().replace(" ", ",")
                                zipado[i][0] = zipado[i][0].toString().split(",")
                                zipado[i][0].forEach(element => {
                                    element = element.replace('"', '')
                                    element =  element.trim()
                                    if(element != "email" && element != "" && endereco["tags"].indexOf(element) == -1){
                                        endereco["tags"].push(element)        
                                    }
                                });
                                emailJaCadastrado = true     
                            }
                        });
                        //caso o email seja novo
                        if(! emailJaCadastrado){
                            //criamos um novo object address
                            let address = {}
                            //verificamos atraves da função checkEmail se o email é valido
                            if(checkEmail(email)){    
                                //caso seja valido, parseamos as informações do header para adicionar as tags
                                address["type"] = "email"
                                address["tags"] = []
                                zipado[i][0] = zipado[i][0].toString().replace(" ", ",")
                                zipado[i][0] = zipado[i][0].toString().split(",")
                                zipado[i][0].forEach(element => {
                                    element = element.replace('"', '')
                                    element =  element.trim()
                                    if(element != "email" && element != ""){
                                        address["tags"].push(element)        
                                    }
                                });
                                address["address"] = email 
                                //enviamos o address recem criado para a lista de address do objeto que estamos cosntruindo          
                                obj["addresses"].push(address)    
                            }
                        }
                    });
                } 
            }
        }
    }
    //por ultimo, apos passarmos por todos os elementos da linha e adicionarmos as informações em "obj", adicionamos obj no nosso array de objetos
    arrayobj.push(obj)
}

/*
 *Como podemos observar pelo input de exemplo fornecido, podemos ter um caso onde a mesma pessoa é passada em linhas diferentes
 *nesse caso o output deve ser a combinação das informações das duas ou mais linhas referentes a mesma pessoa
 *Sendo assim, para resolver isso, após gerarmos todos os nossos objects e os armazenarmos num array, percorremos esse array para 
 *verificar se dois elementos tem o mesmo "eid". Caso seja esse o caso, juntamos as informções dos 2 elementos no primeiro e deletamos o segundo   
 */

//tamanho do nosso array
let tamanhoArray = arrayobj.length

for (let i = 0; i < tamanhoArray; i++) {
    for (let j = 0; j < tamanhoArray; j++) {
        //caso 2 elementos (que nao sejam o mesmo) tenham o mesmo eid
        if(arrayobj[i].eid == arrayobj[j].eid && i != j){
            //usamos a função "concat" para concatenar os arrays de "addresses" e de "classes"
            arrayobj[i].addresses = (arrayobj[i].addresses).concat((arrayobj[j].addresses))
            arrayobj[i].classes = (arrayobj[i].classes).concat((arrayobj[j].classes))
            //como não foi especificado se caso o campo insible ou see_all fosse diferente entre as 2 linhas, considerei que,
            //caso o campo não estivesse vazio na segunda ocorrencia, deveriamos considerar o valor da segunda ocorrencia
            if(arrayobj[j].invisible =! ""){
                arrayobj[i].invisible = arrayobj[j].invisible
            }
            if(arrayobj[j].see_all =! ""){
                arrayobj[i].see_all = arrayobj[j].see_all
            }    
        //removemos a segunda ocorrencia da pessoa retetida e diminuimos em 1 o tamanho do vetor
        arrayobj.splice(j,1)  
        tamanhoArray -= tamanhoArray
        }
    }
}

//substituimos as ocorrencias de " '' ", "no" e "0" nos campos see_all e invisible por "false"
arrayobj.forEach(objeto => {
    if(objeto.see_all == "" || objeto.see_all == "no" || objeto.see_all == 0){
        objeto.see_all = false
    }
    else{
        objeto.see_all = true
    }
    if(objeto.invisible == "" || objeto.invisible == "no" || objeto.invisible == 0){
        objeto.invisible = false
    }
    else{
        objeto.invisible = true
    }
    //Verificamos caso o aluno so esteja em uma classe, representamos como string, igual no exemplo fornecido
    if(objeto.classes.length == 1){
        objeto.classes = objeto.classes.toString()
    }
});

//transformamos o json em string e escrevemos no arquivo "output.json"
arrayobjStr = JSON.stringify(arrayobj, null, '\t')
fs.writeFileSync("./output.json", arrayobjStr)